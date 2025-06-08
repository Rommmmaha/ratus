# ratus-client-rust

**ratus-client-rust** — це Rust-клієнт для Windows, який підключається до ratus-server, передає скріншоти екрану в реальному часі та приймає віддалені команди керування мишею/клавіатурою.

## Призначення

- Підключення до WebSocket-сервера
- Передача скріншотів екрану (JPEG, base64) адміністратору
- Прийом та виконання команд миші/клавіатури від адміністратора
- Підтримка reconnection та автоматичного запуску стріму

## Технології

- [Rust](https://www.rust-lang.org/)
- [tokio](https://tokio.rs/) (асинхронність)
- [tokio-tungstenite](https://github.com/snapview/tokio-tungstenite) (WebSocket)
- [serde, serde_json](https://serde.rs/) (серіалізація)
- [win-screenshot](https://github.com/dennis-hamester/win-screenshot) (зняття скріншотів)
- [winapi](https://docs.rs/winapi/) (робота з Win32 API)

## Структура

- `src/main.rs` — основна логіка клієнта
- `Cargo.toml` — залежності

## Встановлення та збірка

1. Встановіть [Rust toolchain](https://rustup.rs/)
2. Встановіть залежності: `cargo build --release`
3. Готовий exe буде у `target/release/ratus-client-rust.exe`

## Використання

- Запустіть exe-файл на клієнтському ПК (Windows)
- Клієнт автоматично підключиться до сервера (адреса в коді, змінюйте WS_URL у main.rs за потреби)
- Після підключення адміністратор зможе бачити екран і керувати мишею/клавіатурою

## Залежності

- tokio, tokio-tungstenite, tungstenite, serde, serde_json, base64, win-screenshot, image, futures-util, winapi
