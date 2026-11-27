/**
 * 无遮韩漫 — Venera 源
 * 站域名：https://www.wxzhm.top（Legado 规则写的是 http://www.wxzhm.top/，2026-11-27 实测 http 301 跳转到 https；发布页 www.hmfby.com）
 * 基于 Legado 规则：bookSource_瘦身版.json「无遮韩漫」(customOrder 320)，搜索 /search?keyword={key}，目录 #detail-list-select，图片 #cp_img img.lazy@data-original
 * 验证日期：2026-11-27（curl 实测：搜索“寄宿”返回 5 条；详情 /book/479 200；目录多话；章节页 /chapter/18238 内 59 张图，图 https://www.jjmhw13.one/static/upload/book/479/18238/471404.jpg 200；封面 200）
 * 注意：图片实际托管在 www.jjmhw13.one（data-original 绝对地址），不带 Referer 也能打开。
 */

/** @type {import('./_venera_.js')} */

const WUZHE_BASE = "https://www.wxzhm.top";
const WUZHE_UA = "Mozilla/5.0 (Linux; Android 10; MI 8 Build/QKQ1.190828.002; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/100.0.4896.127 Mobile Safari/537.36";

/**
 * 解析搜索结果条目（.book-list li）
 * .book-list-info-title 标题，.book-list-info a 链接 /book/{id}，.book-list-cover img@data-original 封面
 */
function parseSearchCard(card) {
    try {
        const a = card.querySelector(".book-list-info a");
        if (!a) return null;
        const href = a.attributes["href"] || "";
        const m = href.match(/\/book\/(\d+)/);
        if (!m) return null;
        const titleEl = card.querySelector(".book-list-info-title");
        const title = titleEl ? titleEl.text.trim() : m[1];
        const img = card.querySelector(".book-list-cover img");
        const cover = img ? (img.attributes["data-original"] || img.attributes["src"] || "") : "";
        return new Comic({
            id: m[1],
            title: title,
            cover: cover,
        });
    } catch (e) {
        return null;
    }
}

/**
 * 解析分类列表条目（.manga-list-2 li，Legado ruleExplore）
 */
function parseExploreCard(card) {
    try {
        const a = card.querySelector(".manga-list-2-title a");
        if (!a) return null;
        const href = a.attributes["href"] || "";
        const m = href.match(/\/book\/(\d+)/);
        if (!m) return null;
        const title = a.text.trim() || m[1];
        const img = card.querySelector(".manga-list-2-cover img");
        const cover = img ? (img.attributes["data-original"] || img.attributes["src"] || "") : "";
        return new Comic({
            id: m[1],
            title: title,
            cover: cover,
        });
    } catch (e) {
        return null;
    }
}

function parseMaxPage(doc) {
    const pag = doc.querySelector("ul.pagination");
    if (!pag) return 1;
    let max = 1;
    pag.querySelectorAll("a").forEach((a) => {
        const n = parseInt(a.text.trim(), 10);
        if (!Number.isNaN(n) && n > max) max = n;
    });
    return max;
}

class Wuzhe extends ComicSource {
    name = "无遮韩漫";
    key = "wuzhe";

    version = "1.0.0";
    minAppVersion = "1.4.6";

    url = "https://cdn.jsdelivr.net/gh/3176289965f-ai/my-venera-sources@main/wuzhe.js";

    init() {}

    async getHtml(url) {
        const resp = await Network.get(url, { "User-Agent": WUZHE_UA });
        if (resp.status !== 200) throw new Error(resp.status);
        return resp.body;
    }

    /// explore：分类 /booklist?tag=全部&area=-1&end=-1&page={page}
    explore = [
        {
            title: "全部",
            type: "multiPageComicList",
            load: async (page) => {
                if (!page) page = 1;
                const url = `${WUZHE_BASE}/booklist?tag=%E5%85%A8%E9%83%A8&area=-1&end=-1&page=${page}`;
                const html = await this.getHtml(url);
                const doc = new HtmlDocument(html);
                const comics = [];
                doc.querySelectorAll(".manga-list-2").forEach((card) => {
                    const c = parseExploreCard(card);
                    if (c) comics.push(c);
                });
                const maxPage = parseMaxPage(doc);
                return { comics, maxPage };
            },
            loadNext: async (next) => {},
        },
    ];

    category = {
        title: "无遮韩漫",
        parts: [
            {
                name: "状态",
                type: "fixed",
                categories: ["全部", "连载", "完结"],
                itemType: "category",
                categoryParams: ["-1", "0", "1"],
            },
        ],
        enableRankingPage: false,
    };

    categoryComics = {
        load: async (category, param, options, page) => {
            if (!page) page = 1;
            const url = `${WUZHE_BASE}/booklist?tag=%E5%85%A8%E9%83%A8&area=-1&end=${param}&page=${page}`;
            const html = await this.getHtml(url);
            const doc = new HtmlDocument(html);
            const comics = [];
            doc.querySelectorAll(".manga-list-2").forEach((card) => {
                const c = parseExploreCard(card);
                if (c) comics.push(c);
            });
            const maxPage = parseMaxPage(doc);
            return { comics, maxPage };
        },
        optionList: [],
        ranking: null,
    };

    /// search：/search?keyword={key}
    search = {
        load: async (keyword, options, page) => {
            if (!page) page = 1;
            const kw = (keyword || "").trim();
            if (!kw) return { comics: [], maxPage: 1 };
            const url = `${WUZHE_BASE}/search?keyword=${encodeURIComponent(kw)}`;
            const html = await this.getHtml(url);
            const doc = new HtmlDocument(html);
            const comics = [];
            doc.querySelectorAll(".book-list").forEach((card) => {
                const c = parseSearchCard(card);
                if (c) comics.push(c);
            });
            const maxPage = parseMaxPage(doc);
            return { comics, maxPage };
        },
        loadNext: async (keyword, options, next) => {},
        optionList: [],
        enableTagsSuggestions: false,
    };

    /// 单本漫画
    comic = {
        loadInfo: async (id) => {
            const url = `${WUZHE_BASE}/book/${id}`;
            const html = await this.getHtml(url);
            const doc = new HtmlDocument(html);

            // <title>标题,韩漫标题最终话,…</title>，取逗号前一段
            let title = id;
            const titleEl = doc.querySelector("title");
            if (titleEl) {
                title = titleEl.text.trim().split(",")[0].trim() || id;
            }

            let cover = "";
            doc.querySelectorAll("img[data-original]").forEach((img) => {
                const src = img.attributes["data-original"] || "";
                if (!cover && src.indexOf("/cover.jpg") >= 0) cover = src;
            });

            let lastChapter = "";
            const chapters = new Map();
            doc.querySelectorAll("#detail-list-select li a").forEach((a) => {
                const href = a.attributes["href"] || "";
                const m = href.match(/\/chapter\/(\d+)/);
                if (!m) return;
                const name = a.text.trim() || `第${m[1]}话`;
                chapters.set(m[1], name);
                lastChapter = name;
            });

            return new ComicDetails({
                title: title,
                cover: cover,
                tags: new Map(),
                chapters: chapters,
                url: url,
            });
        },

        loadEp: async (comicId, epId) => {
            const url = `${WUZHE_BASE}/chapter/${epId}`;
            const html = await this.getHtml(url);
            const doc = new HtmlDocument(html);
            const images = [];
            doc.querySelectorAll("#cp_img img").forEach((img) => {
                const src = img.attributes["data-original"] || img.attributes["src"] || "";
                if (src && src.indexOf("http") === 0) images.push(src);
            });
            return { images: images };
        },

        link: {
            domains: ["wxzhm.top", "www.wxzhm.top"],
            linkToId: (url) => {
                const m = url.match(/\/book\/(\d+)/);
                if (!m) throw new Error("Invalid wuzhe url");
                return m[1];
            },
        },
    };
}
