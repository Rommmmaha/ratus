@echo off
SET "ROOT=%~dp0"
echo ROOT is %ROOT%
IF exist "%ROOT%ratus-build" (
  rd /s /q "%ROOT%ratus-build"
)

mkdir "%ROOT%ratus-build"
mkdir "%ROOT%ratus-build\admin"

cd "%ROOT%ratus-server"
CALL bun build ./src/index.ts --compile --outfile "%ROOT%ratus-build\server.exe"
copy /Y "%ROOT%ratus-server\passkeys.json" "%ROOT%ratus-build\passkeys.json"

cd "%ROOT%ratus-admin"
CALL bun run build
xcopy /E /I /Y dist "%ROOT%ratus-build\admin\"

cd "%ROOT%ratus-client-rust"
CALL cargo build --release
copy /Y target\release\ratus-client-rust.exe "%ROOT%ratus-build\client-rust.exe"
