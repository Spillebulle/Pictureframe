"""Chrome Web Store screenshots, 1280 x 800, rendered by the extension itself.

    python docs/store/shots.py

Serves the repository on localhost (so no local path reaches a picture),
loads the unpacked extension into Playwright's Chromium, and drives
docs/store/demo.html. Needs `pip install playwright` and
`playwright install chromium`.
"""
import asyncio, functools, http.server, pathlib, tempfile, threading
from playwright.async_api import async_playwright

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = ROOT / "docs" / "store"
PORT = 8765
URL = f"http://localhost:{PORT}/docs/store/demo.html"


def serve():
    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *args):
            pass
    handler = functools.partial(Quiet, directory=str(ROOT))
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", PORT), handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv


async def main():
    async with async_playwright() as p:
        ctx = await p.chromium.launch_persistent_context(
            tempfile.mkdtemp(), headless=False, channel="chromium",
            viewport={"width": 1280, "height": 800}, color_scheme="dark",
            args=[f"--disable-extensions-except={ROOT}", f"--load-extension={ROOT}", "--headless=new", "--hide-scrollbars"])
        sw = ctx.service_workers[0] if ctx.service_workers else await ctx.wait_for_event("serviceworker")
        await ctx.grant_permissions(["clipboard-read", "clipboard-write"])
        pg = await ctx.new_page()
        await pg.goto(URL, wait_until="networkidle")
        await pg.wait_for_timeout(800)

        # 1. The page, corner button on the hero.
        hero = pg.locator("img.hero")
        await pg.evaluate("window.scrollTo(0, 60)")
        b = await hero.bounding_box()
        for dx in (0, 6):
            await pg.mouse.move(b["x"] + b["width"] * 0.6 + dx, b["y"] + b["height"] * 0.5)
            await pg.wait_for_timeout(400)
        await pg.screenshot(path=str(OUT / "1-page.png"))

        # 2. The viewer, fitted.
        await hero.click()
        await pg.wait_for_timeout(1500)
        await pg.mouse.move(640, 640)
        await pg.wait_for_timeout(600)
        await pg.screenshot(path=str(OUT / "2-viewer.png"))

        # 3. Zoomed past 4x: sharp pixels.
        await pg.mouse.move(470, 470)
        for _ in range(16):
            await pg.mouse.wheel(0, -120)
            await pg.wait_for_timeout(120)
        await pg.mouse.move(640, 740)
        await pg.wait_for_timeout(900)
        await pg.screenshot(path=str(OUT / "3-zoom.png"))
        await pg.keyboard.press("Escape")
        await pg.wait_for_timeout(400)

        # 4. Picking a misfire: the chart canvas.
        await sw.evaluate("""async () => {
            const tabs = await chrome.tabs.query({});
            const tab = tabs.find(t => t.url && t.url.startsWith('http://localhost'));
            return chrome.tabs.sendMessage(tab.id, { action: 'START_REPORT', kind: 'false_negative' });
        }""")
        cv = pg.locator("#elev")
        await pg.evaluate("document.getElementById('elev').scrollIntoView({block: 'center'})")
        await pg.wait_for_timeout(300)
        b = await cv.bounding_box()
        x, y = b["x"] + b["width"] * 0.45, b["y"] + b["height"] * 0.5
        for dx in (0, 4):
            await pg.mouse.move(x + dx, y)
            await pg.wait_for_timeout(300)
        await pg.screenshot(path=str(OUT / "4-pick.png"))

        # 5. The report, ready for an issue.
        await pg.mouse.click(x, y)
        await pg.wait_for_timeout(700)
        await pg.screenshot(path=str(OUT / "5-report.png"))
        await ctx.close()


if __name__ == "__main__":
    srv = serve()
    try:
        asyncio.run(main())
    finally:
        srv.shutdown()
