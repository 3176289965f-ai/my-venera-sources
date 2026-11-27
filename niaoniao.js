/**
 * 鸟鸟韩漫 — Venera 源
 * 站域名：https://nnhm7.com（Legado 规则写的是 https://nnhanman9.com，2026-11-27 实测 301 跳转到 nnhm7.com）
 * 基于 Legado 规则：bookSource_瘦身版.json「鸟鸟韩漫」(customOrder 317)，搜索 /search/{key}/page/{page}，目录 #mh-chapter-list-ol-0
 * 验证日期：2026-11-27（curl 实测：搜索“女大生”有结果；详情 /comic/guo-jun-nv-da-sheng.html 200；目录 61 章；章节页图片 data-src 32 张，图 https://img.nnpic.xyz/upload_s/2023061106/20230611060352245.jpg 200；封面 200）
 * 注意：搜索按标题匹配，类别词（如“狗血劇”）搜不到结果是正常的；章节图片是懒加载 data-src（Legado 规则里的 tbody@all 在现站已失效，改用 #m_r_imgbox_0 img[data-src]）。
 */

/** @type {import('./_venera_.js')} */

const NIAONIAO_BASE = "https://nnhm7.com";
const NIAONIAO_UA = "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";

/**
 * 解析作品卡片（搜索页 ul.col_3_1 li、更新页 .itemBox 通用结构）
 * <a class="ImgA" href="/comic/{slug}.html" title="标题"><picture><img src="封面"></picture></a>
 */
function parseComicCard(card) {
    try {
        const a = card.querySelector("a.ImgA") || card.querySelector('a[href^="/comic/"]');
        if (!a) return null;
        const href = a.attributes["href"] || "";
        const m = href.match(/\/comic\/([^/]+)\.html/);
        if (!m) return null;
        const id = m[1];
        const title = a.attributes["title"] || a.text.trim() || id;
        const img = card.querySelector("img");
        const cover = img ? (img.attributes["src"] || "") : "";
        return new Comic({
            id: id,
            title: title,
            cover: cover,
        });
    } catch (e) {
        return null;
    }
}

function parseComicList(doc, selector) {
    const result = [];
    doc.querySelectorAll(selector).forEach((card) => {
        const c = parseComicCard(card);
        if (c) result.push(c);
    });
    return result;
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

class Niaoniao extends ComicSource {
    name = "鸟鸟韩漫";
    key = "niaoniao";

    version = "1.0.0";
    minAppVersion = "1.4.6";

    url = "https://cdn.jsdelivr.net/gh/3176289965f-ai/my-venera-sources@main/niaoniao.js";

    init() {}

    async getHtml(url) {
        const resp = await Network.get(url, { "User-Agent": NIAONIAO_UA });
        if (resp.status !== 200) throw new Error(resp.status);
        return resp.body;
    }

    /// explore：最新更新 /update
    explore = [
        {
            title: "最新更新",
            type: "multiPageComicList",
            load: async (page) => {
                if (page && page !== 1) return { comics: [], maxPage: 1 };
                const html = await this.getHtml(NIAONIAO_BASE + "/update");
                const doc = new HtmlDocument(html);
                const comics = parseComicList(doc, ".UpdateList .itemBox");
                return { comics, maxPage: 1 };
            },
            loadNext: async (next) => {},
        },
    ];

    category = {
        title: "鸟鸟韩漫",
        parts: [
            {
                name: "更新",
                type: "fixed",
                categories: ["最新更新", "新书发布", "推荐漫画"],
                itemType: "category",
                categoryParams: ["/update", "/update/newbook", "/update/recommend"],
            },
            {
                name: "排行",
                type: "fixed",
                categories: ["周榜", "日榜", "月榜", "总榜"],
                itemType: "category",
                categoryParams: ["/ranking/weekly", "/ranking/daily", "/ranking/monthly", "/ranking/all"],
            },
        ],
        enableRankingPage: false,
    };

    categoryComics = {
        load: async (category, param, options, page) => {
            if (page && page !== 1) return { comics: [], maxPage: 1 };
            const html = await this.getHtml(NIAONIAO_BASE + param);
            const doc = new HtmlDocument(html);
            const comics = parseComicList(doc, ".itemBox");
            return { comics, maxPage: 1 };
        },
        optionList: [],
        ranking: null,
    };

    /// search：/search/{key}/page/{page}
    search = {
        load: async (keyword, options, page) => {
            if (!page) page = 1;
            const kw = (keyword || "").trim();
            if (!kw) return { comics: [], maxPage: 1 };
            const url = `${NIAONIAO_BASE}/search/${encodeURIComponent(kw)}/page/${page}`;
            const html = await this.getHtml(url);
            const doc = new HtmlDocument(html);
            const comics = parseComicList(doc, "ul.col_3_1 li");
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
            const url = `${NIAONIAO_BASE}/comic/${id}.html`;
            const html = await this.getHtml(url);
            const doc = new HtmlDocument(html);

            const titleEl = doc.querySelector("h1");
            const title = titleEl ? titleEl.text.trim().replace(/[《》]/g, "") : id;

            let cover = "";
            doc.querySelectorAll("img").forEach((img) => {
                const src = img.attributes["src"] || "";
                if (!cover && src.indexOf("niaopic.com/upload") >= 0) cover = src;
            });

            const tagsMap = new Map();
            const txtItems = Array.from(doc.querySelectorAll(".txtItme"));
            if (txtItems.length >= 1) {
                const author = txtItems[0].text.trim();
                if (author) tagsMap.set("作者", [author]);
            }
            if (txtItems.length >= 2) {
                const kind = txtItems[1].text.trim();
                if (kind) tagsMap.set("分类", [kind]);
            }

            let description = "";
            const descEl = doc.querySelector(".txtDesc");
            if (descEl) description = descEl.text.trim();

            // 目录：#mh-chapter-list-ol-0 li（老版 .Drama li 作兜底）
            const chapters = new Map();
            let chapterLinks = doc.querySelectorAll("#mh-chapter-list-ol-0 li a");
            if (!chapterLinks.length) chapterLinks = doc.querySelectorAll(".Drama li a");
            chapterLinks.forEach((a) => {
                const href = a.attributes["href"] || "";
                const m = href.match(/\/chapter-(\d+)\.html/);
                if (!m) return;
                const name = a.text.trim() || `第${m[1]}话`;
                chapters.set(`chapter-${m[1]}`, name);
            });

            return new ComicDetails({
                title: title,
                cover: cover,
                description: description,
                tags: tagsMap,
                chapters: chapters,
                url: url,
            });
        },

        loadEp: async (comicId, epId) => {
            const url = `${NIAONIAO_BASE}/comic/${comicId}/${epId}.html`;
            const html = await this.getHtml(url);
            const doc = new HtmlDocument(html);
            const images = [];
            doc.querySelectorAll("#m_r_imgbox_0 img").forEach((img) => {
                const src = img.attributes["data-src"] || img.attributes["src"] || "";
                if (src && src.indexOf("http") === 0) images.push(src);
            });
            return { images: images };
        },

        onImageLoad: (url, comicId, epId) => {
            return {
                url,
                headers: {
                    referer: NIAONIAO_BASE + "/",
                },
            };
        },

        onThumbnailLoad: (url) => {
            return {
                url,
                headers: {
                    referer: NIAONIAO_BASE + "/",
                },
            };
        },

        link: {
            domains: ["nnhm7.com", "nnhanman9.com"],
            linkToId: (url) => {
                const m = url.match(/\/comic\/([^/]+)\.html/);
                if (!m) throw new Error("Invalid niaoniao url");
                return m[1];
            },
        },
    };
}
