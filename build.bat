@echo off
SET "ROOT=%~dp0"
IF exist "%ROOT%!ratus-production" (
  rd /s /q "%ROOT%!ratus-production"
)

mkdir "%ROOT%!ratus-production"
mkdir "%ROOT%!ratus-production\admin"

cd "%ROOT%ratus-server"
CALL bun build ./src/index.ts --compile --outfile "%ROOT%!ratus-production\server.exe"
copy /Y "%ROOT%ratus-server\passkeys.json" "%ROOT%!ratus-production\passkeys.json"

cd "%ROOT%ratus-admin"
CALL bun run build
xcopy /E /I /Y dist "%ROOT%!ratus-production\admin\"

cd "%ROOT%ratus-client-rust"
CALL cargo build --release
copy /Y target\release\ratus-client-rust.exe "%ROOT%!ratus-production\client-rust.exe"
