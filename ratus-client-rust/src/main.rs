// --- Imports ---
use base64::{Engine as _, engine::general_purpose};
use clap::Parser;
use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use std::{
    error::Error,
    sync::{
        Arc,
        atomic::{AtomicBool, Ordering},
    },
};
use tokio::{
    sync::Mutex,
    task::JoinHandle,
    time::{Duration, sleep},
};
use tokio_tungstenite::connect_async;
use tungstenite::Message;
use win_screenshot::prelude::*;
use winapi::um::winuser::{GetSystemMetrics, SM_CXSCREEN, SM_CYSCREEN};

// --- Constants ---
const WS_URL: &str = "ws://127.0.0.1:5555";
const DEFAULT_RECONNECT_DELAY_SECS: u64 = 2;
const DEFAULT_STREAM_INTERVAL_MS: u64 = 0;
const DEFAULT_JPEG_QUALITY: u8 = 80;

/// Command-line arguments
#[derive(Parser, Debug)]
#[command(author, version, about, long_about = None)]
struct Cli {
    /// WebSocket server address
    #[arg(short, long, default_value = WS_URL)]
    address: String,
    /// Reconnect delay in seconds
    #[arg(long, default_value_t = DEFAULT_RECONNECT_DELAY_SECS)]
    reconnect_delay_secs: u64,
    /// Stream interval in milliseconds
    #[arg(long, default_value_t = DEFAULT_STREAM_INTERVAL_MS)]
    stream_interval_ms: u64,
    /// JPEG quality (0-100)
    #[arg(long, default_value_t = DEFAULT_JPEG_QUALITY)]
    jpeg_quality: u8,
}

// --- Data Structures ---

/// Packet for mouse events
#[derive(Serialize, Deserialize, Debug)]
struct MousePacket {
    #[serde(rename = "type")]
    packet_type: String,
    action: String, // "move", "down", "up", "wheel"
    key: i32,       // -1, 0, 1, 2
    x: f64,
    y: f64,
}

/// Packet for login
#[derive(Serialize, Deserialize, Debug)]
struct LoginPacket<'a> {
    #[serde(rename = "type")]
    packet_type: &'a str,
    role: &'a str,
}

/// Packet for screen request
#[derive(Serialize, Deserialize, Debug)]
struct ScreenPacket<'a> {
    #[serde(rename = "type")]
    packet_type: &'a str,
    from: &'a str,
}

/// Packet for sending a frame
#[derive(Serialize, Deserialize, Debug)]
struct FramePacket<'a> {
    #[serde(rename = "type")]
    packet_type: &'a str,
    receiver: &'a str,
    data: String,
    mouse: MouseInfo,
}

/// Mouse position and state info
#[derive(Serialize, Deserialize, Debug)]
struct MouseInfo {
    x: f64,
    y: f64,
    state: String,
}

/// Main async entry point. Handles connection, reconnection, and message dispatch.
#[tokio::main]
async fn main() -> Result<(), Box<dyn Error>> {
    let cli = Cli::parse();
    let ws_url = cli.address.as_str();

    loop {
        // Attempt to connect to the WebSocket server
        let ws_result = connect_async(ws_url).await;
        if let Err(e) = ws_result {
            eprintln!(
                "[INFO] Failed to connect: {}. Retrying in {} seconds...",
                e, cli.reconnect_delay_secs
            );
            sleep(Duration::from_secs(cli.reconnect_delay_secs)).await;
            continue;
        }
        let (ws_stream, _) = ws_result.unwrap();
        let (write, mut read) = ws_stream.split();
        let write = Arc::new(Mutex::new(write));

        // Send login packet
        let login = LoginPacket {
            packet_type: "login",
            role: "user",
        };
        let login_json = serde_json::to_string(&login)?;
        if let Err(e) = write
            .lock()
            .await
            .send(Message::Text(login_json.into()))
            .await
        {
            eprintln!("[INFO] Failed to send login: {}. Reconnecting...", e);
            sleep(Duration::from_secs(cli.reconnect_delay_secs)).await;
            continue;
        }

        // State for streaming
        let streaming = Arc::new(AtomicBool::new(false));
        let mut stream_task: Option<JoinHandle<()>> = None;
        let mut disconnected = false;

        // Main message loop
        while let Some(msg) = read.next().await {
            let msg = match msg {
                Ok(m) => m,
                Err(e) => {
                    eprintln!("[INFO] Disconnected: {}. Reconnecting...", e);
                    disconnected = true;
                    break;
                }
            };
            if let Message::Text(txt) = msg {
                print_incoming_packet(&txt);
                match serde_json::from_str::<serde_json::Value>(&txt) {
                    Ok(json) => {
                        if let Some(packet_type) = json.get("type").and_then(|v| v.as_str()) {
                            match packet_type {
                                "screen" => {
                                    handle_screen_packet(&txt, &write).await?;
                                }
                                "mouse" => {
                                    handle_mouse_packet(&txt);
                                }
                                "key" => {
                                    handle_key_packet(&txt);
                                }
                                "stream_start" => {
                                    handle_stream_start_packet(
                                        &txt,
                                        &streaming,
                                        &write,
                                        &mut stream_task,
                                        cli.stream_interval_ms,
                                        cli.jpeg_quality,
                                    )
                                    .await;
                                }
                                "stream_stop" => {
                                    handle_stream_stop_packet(&streaming, &mut stream_task).await;
                                }
                                "exit" => {
                                    std::process::exit(0);
                                }
                                _ => {}
                            }
                        }
                    }
                    Err(e) => {
                        eprintln!("[WARN] Failed to parse packet: {}", e);
                    }
                }
            }
        }

        // Clean up streaming task if needed
        if let Some(task) = stream_task.take() {
            task.abort();
        }
        if !disconnected {
            break;
        }
        eprintln!(
            "[INFO] Reconnecting in {} seconds...",
            cli.reconnect_delay_secs
        );
        sleep(Duration::from_secs(cli.reconnect_delay_secs)).await;
    }
    Ok(())
}
// --- Utility Functions ---

/// Print incoming packet for debugging
fn print_incoming_packet(raw: &str) {
    println!("[INCOMING PACKAGE] {}", raw);
}

/// Capture the screen and return as base64-encoded JPEG data URL
fn capture_screen_base64(jpeg_quality: u8) -> Option<String> {
    let buf = capture_display().ok()?;
    let buffer = image::RgbaImage::from_raw(buf.width, buf.height, buf.pixels)?;
    let img = image::DynamicImage::ImageRgba8(buffer);
    let mut bytes = std::io::Cursor::new(Vec::new());
    if image::codecs::jpeg::JpegEncoder::new_with_quality(&mut bytes, jpeg_quality)
        .encode_image(&img)
        .is_ok()
    {
        let mut data_url = String::from("data:image/jpeg;base64,");
        data_url.push_str(&general_purpose::STANDARD.encode(bytes.get_ref()));
        Some(data_url)
    } else {
        None
    }
}

/// Get normalized mouse position and state
fn get_mouse_info() -> MouseInfo {
    use winapi::shared::windef::POINT;
    use winapi::um::winuser::GetCursorPos;
    let mut pt = POINT { x: 0, y: 0 };
    let (x, y) = unsafe {
        if GetCursorPos(&mut pt) != 0 {
            (pt.x as f64, pt.y as f64)
        } else {
            (0.0, 0.0)
        }
    };
    let screen_width = unsafe { GetSystemMetrics(SM_CXSCREEN) } as f64;
    let screen_height = unsafe { GetSystemMetrics(SM_CYSCREEN) } as f64;
    let norm_x = if screen_width > 0.0 {
        (x / screen_width * 65535.0).clamp(0.0, 65535.0)
    } else {
        0.0
    };
    let norm_y = if screen_height > 0.0 {
        (y / screen_height * 65535.0).clamp(0.0, 65535.0)
    } else {
        0.0
    };
    MouseInfo {
        x: norm_x,
        y: norm_y,
        state: get_mouse_state(),
    }
}

/// Placeholder for mouse state (extend as needed)
fn get_mouse_state() -> String {
    "default".to_string()
}

// --- Packet Handlers ---

/// Handle incoming mouse packet and simulate mouse events
fn handle_mouse_packet(txt: &str) {
    use winapi::um::winuser::{GetSystemMetrics, SM_CXSCREEN, SM_CYSCREEN};
    use winapi::um::winuser::{
        MOUSEEVENTF_LEFTDOWN, MOUSEEVENTF_LEFTUP, MOUSEEVENTF_MIDDLEDOWN, MOUSEEVENTF_MIDDLEUP,
        MOUSEEVENTF_RIGHTDOWN, MOUSEEVENTF_RIGHTUP, MOUSEEVENTF_WHEEL, SetCursorPos, mouse_event,
    };
    if let Ok(packet) = serde_json::from_str::<MousePacket>(txt) {
        // Convert 0-65535 to screen coordinates (full screen)
        let screen_w = unsafe { GetSystemMetrics(SM_CXSCREEN) } as f64;
        let screen_h = unsafe { GetSystemMetrics(SM_CYSCREEN) } as f64;
        let px = ((packet.x / 65535.0) * (screen_w - 1.0)).round() as i32;
        let py = ((packet.y / 65535.0) * (screen_h - 1.0)).round() as i32;
        unsafe {
            SetCursorPos(px, py);
        }
        match packet.action.as_str() {
            "down" => {
                let down_flag = match packet.key {
                    0 => MOUSEEVENTF_LEFTDOWN,
                    1 => MOUSEEVENTF_MIDDLEDOWN,
                    2 => MOUSEEVENTF_RIGHTDOWN,
                    _ => MOUSEEVENTF_LEFTDOWN,
                };
                unsafe {
                    mouse_event(down_flag, 0, 0, 0, 0);
                }
            }
            "up" => {
                let up_flag = match packet.key {
                    0 => MOUSEEVENTF_LEFTUP,
                    1 => MOUSEEVENTF_MIDDLEUP,
                    2 => MOUSEEVENTF_RIGHTUP,
                    _ => MOUSEEVENTF_LEFTUP,
                };
                unsafe {
                    mouse_event(up_flag, 0, 0, 0, 0);
                }
            }
            "wheel" => {
                let delta = match packet.key {
                    -1 => 120i32, // up
                    1 => -120i32, // down
                    _ => 0i32,
                } as u32;
                unsafe {
                    mouse_event(MOUSEEVENTF_WHEEL, 0, 0, delta, 0);
                }
            }
            _ => {}
        }
    }
}

/// Handle incoming key packet and simulate keyboard events
fn handle_key_packet(txt: &str) {
    use serde_json::Value;
    use winapi::um::winuser::{KEYEVENTF_KEYUP, keybd_event};
    if let Ok(json) = serde_json::from_str::<Value>(txt) {
        let keycode = json
            .get("keycode")
            .and_then(|v| v.as_str())
            .and_then(|s| s.parse::<u8>().ok());
        let action = json.get("action").and_then(|v| v.as_str());
        if let (Some(keycode), Some(action)) = (keycode, action) {
            unsafe {
                match action {
                    "down" => keybd_event(keycode, 0, 0, 0),
                    "up" => keybd_event(keycode, 0, KEYEVENTF_KEYUP, 0),
                    "press" => {
                        keybd_event(keycode, 0, 0, 0);
                        keybd_event(keycode, 0, KEYEVENTF_KEYUP, 0);
                    }
                    _ => {}
                }
            }
        }
    }
}

/// Handle incoming screen packet and send a frame
async fn handle_screen_packet<S>(txt: &str, write: &Arc<Mutex<S>>) -> Result<(), Box<dyn Error>>
where
    S: SinkExt<Message> + Unpin,
    <S as futures_util::Sink<Message>>::Error: std::error::Error + Send + Sync + 'static,
{
    let screen: ScreenPacket = serde_json::from_str(txt)?;
    send_frame_packet(write, screen.from).await?;
    Ok(())
}

/// Start streaming frames in a background task
async fn handle_stream_start_packet<S>(
    _txt: &str,
    streaming: &Arc<AtomicBool>,
    write: &Arc<Mutex<S>>,
    stream_task: &mut Option<JoinHandle<()>>,
    stream_interval_ms: u64,
    jpeg_quality: u8,
) where
    S: SinkExt<Message> + Unpin + Send + 'static,
    <S as futures_util::Sink<Message>>::Error: std::error::Error + Send + Sync + 'static,
{
    if !streaming.load(Ordering::SeqCst) {
        streaming.store(true, Ordering::SeqCst);
        let write_clone = Arc::clone(write);
        let streaming_clone = Arc::clone(streaming);
        *stream_task = Some(tokio::spawn(async move {
            while streaming_clone.load(Ordering::SeqCst) {
                let _ = send_frame_packet_with_quality(&write_clone, "", jpeg_quality).await;
                sleep(Duration::from_millis(stream_interval_ms)).await;
            }
        }));
    }
}

/// Stop streaming frames
async fn handle_stream_stop_packet(
    streaming: &Arc<AtomicBool>,
    stream_task: &mut Option<JoinHandle<()>>,
) {
    if streaming.load(Ordering::SeqCst) {
        streaming.store(false, Ordering::SeqCst);
        if let Some(task) = stream_task.take() {
            task.abort();
        }
    }
}

/// Send a frame packet (screen + mouse info)
async fn send_frame_packet<S>(write: &Arc<Mutex<S>>, receiver: &str) -> Result<(), Box<dyn Error>>
where
    S: SinkExt<Message> + Unpin,
    <S as futures_util::Sink<Message>>::Error: std::error::Error + Send + Sync + 'static,
{
    if let Some(b64) = capture_screen_base64(DEFAULT_JPEG_QUALITY) {
        let mouse = get_mouse_info();
        let frame = FramePacket {
            packet_type: "frame",
            receiver,
            data: b64,
            mouse,
        };
        let frame_json = serde_json::to_string(&frame)?;
        write
            .lock()
            .await
            .send(Message::Text(frame_json.into()))
            .await?;
    }
    Ok(())
}

async fn send_frame_packet_with_quality<S>(
    write: &Arc<Mutex<S>>,
    receiver: &str,
    jpeg_quality: u8,
) -> Result<(), Box<dyn std::error::Error>>
where
    S: SinkExt<Message> + Unpin,
    <S as futures_util::Sink<Message>>::Error: std::error::Error + Send + Sync + 'static,
{
    if let Some(b64) = capture_screen_base64(jpeg_quality) {
        let mouse = get_mouse_info();
        let frame = FramePacket {
            packet_type: "frame",
            receiver,
            data: b64,
            mouse,
        };
        let frame_json = serde_json::to_string(&frame)?;
        write
            .lock()
            .await
            .send(Message::Text(frame_json.into()))
            .await?;
    }
    Ok(())
}
