"use strict";
const { Plugin, FileView, MarkdownRenderChild } = require("obsidian");

const VIEW_TYPE = "better-html-reader-view";
const EXTENSIONS = ["html", "htm"];

const BRIDGE = `<script>(function(){
  document.addEventListener("click",function(e){
    var a=e.target.closest&&e.target.closest('a[href^="#"]');
    if(!a)return;e.preventDefault();
    var id=decodeURIComponent(a.getAttribute("href").slice(1));
    var t=id?document.getElementById(id)||document.getElementsByName(id)[0]:document.body;
    if(t)t.scrollIntoView();
  });
  function h(){parent.postMessage({betterHtmlHeight:document.documentElement.scrollHeight},"*");}
  addEventListener("load",h);
  if(window.ResizeObserver)new ResizeObserver(h).observe(document.documentElement);
})();<\/script>`;

function buildDoc(html, baseHref) {
  const base = baseHref ? `<base href="${baseHref.replace(/"/g, "&quot;")}">` : "";
  const csp = `<meta http-equiv="Content-Security-Policy" content="connect-src https: http: wss: ws: data: blob:">`;
  const inject = csp + base;
  const head = /<head[^>]*>/i, htmlTag = /<html[^>]*>/i, doctype = /^\s*<!doctype[^>]*>/i;
  if (head.test(html)) html = html.replace(head, (m) => m + inject);
  else if (htmlTag.test(html)) html = html.replace(htmlTag, (m) => m + inject);
  else if (doctype.test(html)) html = html.replace(doctype, (m) => m + inject);
  else html = inject + html;
  return html + BRIDGE;
}

function resolvePath(fromPath, href) {
  const parts = fromPath.split("/").slice(0, -1);
  for (const seg of decodeURIComponent(href.split(/[?#]/)[0]).split("/")) {
    if (seg === "..") parts.pop();
    else if (seg && seg !== ".") parts.push(seg);
  }
  return parts.join("/");
}

async function inlineLocal(app, html, sourcePath) {
  const isLocal = (u) => u && !/^([a-z][a-z0-9+.-]*:|\/\/|#)/i.test(u);
  const doc = new DOMParser().parseFromString(html, "text/html");
  const read = (u, ext) => {
    const path = resolvePath(sourcePath, u);
    if (!path.toLowerCase().endsWith(ext) || path.split("/").some((s) => s.startsWith("."))) return null;
    return app.vault.adapter.read(path).catch(() => null);
  };
  for (const link of doc.querySelectorAll("link[rel~=stylesheet][href]")) {
    const href = link.getAttribute("href");
    if (!isLocal(href)) continue;
    const css = await read(href, ".css");
    if (css === null) continue;
    const style = doc.createElement("style");
    style.textContent = css;
    link.replaceWith(style);
  }
  for (const script of doc.querySelectorAll("script[src]")) {
    const src = script.getAttribute("src");
    if (!isLocal(src)) continue;
    const js = await read(src, ".js");
    if (js === null) continue;
    script.removeAttribute("src");
    script.textContent = js.replace(/<\/script/gi, "<\\/script");
  }
  const dt = /^\s*<!doctype/i.test(html) ? "<!DOCTYPE html>\n" : "";
  return dt + doc.documentElement.outerHTML;
}

function createFrame(parent, html, baseHref) {
  const iframe = parent.createEl("iframe");
  iframe.setAttribute("sandbox", "allow-scripts allow-popups allow-forms allow-downloads");
  iframe.srcdoc = buildDoc(html, baseHref);
  return iframe;
}

function baseFor(app, path) {
  const url = app.vault.adapter.getResourcePath(path).split("?")[0];
  return url.replace(/[^/]*$/, "");
}

class HtmlFileView extends FileView {
  getViewType() { return VIEW_TYPE; }
  getIcon() { return "code-glyph"; }
  canAcceptExtension(ext) { return EXTENSIONS.includes(ext); }

  async onOpen() {
    this.contentEl.addClass("better-html-view");
    this.registerEvent(this.app.vault.on("modify", (f) => {
      if (this.file && f.path === this.file.path) this.render();
    }));
  }

  async onLoadFile() { await this.render(); }

  async render() {
    if (!this.file) return;
    const html = await inlineLocal(this.app, await this.app.vault.read(this.file), this.file.path);
    this.contentEl.empty();
    createFrame(this.contentEl, html, baseFor(this.app, this.file.path));
  }
}

module.exports = class BetterHtmlReaderPlugin extends Plugin {
  async onload() {
    this.registerView(VIEW_TYPE, (leaf) => new HtmlFileView(leaf));
    this.registerExtensions(EXTENSIONS, VIEW_TYPE);

    this.registerMarkdownCodeBlockProcessor("htmlrender", async (source, el, ctx) => {
      const wrap = el.createDiv({ cls: "better-html-block" });
      source = await inlineLocal(this.app, source, ctx.sourcePath);
      const iframe = createFrame(wrap, source, baseFor(this.app, ctx.sourcePath));
      const onMsg = (e) => {
        if (e.source === iframe.contentWindow && e.data && typeof e.data.betterHtmlHeight === "number") {
          const h = Math.min(Math.max(Math.ceil(e.data.betterHtmlHeight) || 0, 50), 20000);
          iframe.style.height = h + "px";
        }
      };
      const child = new MarkdownRenderChild(wrap);
      child.onload = () => window.addEventListener("message", onMsg);
      child.onunload = () => window.removeEventListener("message", onMsg);
      ctx.addChild(child);
    });
  }
};
