import { BrowserWindow as e, app as t, dialog as n, ipcMain as r, shell as i } from "electron";
import { readFile as a, stat as o } from "node:fs/promises";
import { basename as s, dirname as c, join as l } from "node:path";
import { fileURLToPath as u } from "node:url";
//#region src/main/index.ts
var d = c(u(import.meta.url)), f = 104857600;
process.on("uncaughtException", (e) => {
	console.error("Main process uncaught exception:", e);
}), process.on("unhandledRejection", (e) => {
	console.error("Main process unhandled rejection:", e);
}), t.disableHardwareAcceleration();
var p = null;
function m() {
	p = new e({
		width: 1280,
		height: 800,
		minWidth: 900,
		minHeight: 600,
		show: !1,
		backgroundColor: "#0d1117",
		webPreferences: {
			preload: l(d, "preload.cjs"),
			contextIsolation: !0,
			nodeIntegration: !1,
			sandbox: !1
		}
	}), p.on("ready-to-show", () => p?.show()), p.on("closed", () => {
		p = null;
	}), p.webContents.setWindowOpenHandler(({ url: e }) => (i.openExternal(e), { action: "deny" }));
	let t = process.env.VITE_DEV_SERVER_URL;
	t ? p.loadURL(t) : p.loadFile(l(d, "../dist/index.html"));
}
r.handle("file:open-dialog", async () => {
	if (!p) return null;
	try {
		let e = await n.showOpenDialog(p, {
			properties: ["openFile"],
			filters: [{
				name: "Spreadsheets",
				extensions: [
					"csv",
					"tsv",
					"xlsx",
					"xls"
				]
			}]
		});
		if (e.canceled || e.filePaths.length === 0) return null;
		let t = e.filePaths[0], r = await o(t);
		if (r.size > f) return n.showErrorBox("File Too Large", `The selected file is ${(r.size / 1048576).toFixed(1)} MB. Files larger than 100 MB cannot be opened to prevent memory exhaustion.`), null;
		let i = await a(t);
		return {
			name: s(t),
			bytes: new Uint8Array(i)
		};
	} catch (e) {
		return console.error("Error opening file via dialog:", e), n.showErrorBox("Error Reading File", `Could not read the selected file: ${e instanceof Error ? e.message : String(e)}`), null;
	}
}), t.whenReady().then(() => {
	console.log("Spreadsheet Grapher main process ready!"), m(), t.on("activate", () => {
		e.getAllWindows().length === 0 && m();
	});
}), t.on("window-all-closed", () => {
	process.platform !== "darwin" && t.quit();
});
//#endregion
export {};
