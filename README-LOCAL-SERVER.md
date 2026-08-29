Local hosting instructions for this project

Requirements
- Node.js (16+ recommended) with `npm` available in PATH

Quick start (PowerShell / CMD):

1. Open a terminal in the project root (where `server.js` and `package.json` live).

2. Install dependencies:

```powershell
npm install
```

3. Start the server:

```powershell
npm start
```

You should see:

```
Server running on http://localhost:3000
```

Then open the app at:

http://localhost:3000/index.html

Where uploaded files are saved
- Files uploaded via the UI are written into the `projects/` folder next to `index.html` when using the included Node server.

Path example on this machine:

```
c:\Users\KESHU\Desktop\28-08-2026\csl cad view worked1\projects\
```

Using another server
- The client supports a configurable API base URL. You can append `?apiBase=` to the URL when opening the app to point to any server, for example:

```
http://localhost:3000/index.html?apiBase=https://yourserver.com/
```

- Your server should expose two endpoints relative to `apiBase`:
  - `GET api/projects` — returns a JSON tree describing folders and files (matching the format used by the client).
  - `POST upload` — accepts `multipart/form-data` (field name `files`) and saves files to a projects storage location. Each uploaded file's original name may include a relative path (clients send `webkitRelativePath` when available).

- If you host the static site separately (e.g., GitHub Pages), set `apiBase` to your backend host where `upload` and `api/projects` are implemented.
 
Browser-only mode (no server)
- If you cannot run a backend, the client will automatically fall back to storing uploaded files in your browser using IndexedDB. That lets the Projects panel and viewer work on static hosts like GitHub Pages.
- When the backend is unavailable, uploads are saved to browser storage and will persist in that browser on that machine. To clear them, use browser site storage settings or call the provided `IDBStorage.clearAll()` from DevTools.

Troubleshooting
- `ERR_CONNECTION_REFUSED` means the server isn't running or a firewall is blocking the port.
  - Confirm `npm start` shows the server message.
  - Check Windows Firewall or antivirus blocking Node.js.
  - Confirm nothing else is listening on port 3000.
    - PowerShell: `netstat -ano | Select-String ":3000"`
    - Or: `netstat -a -n -o | findstr 3000`
  - If Node isn't installed, download from https://nodejs.org/ and reinstall.

Automated helper
- `start-server.bat` (created next to this README) runs `npm install` then `npm start` for convenience.
