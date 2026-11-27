/**
 * MANHUA18 — Venera 源
 * 站域名：https://manhwa18.cc
 * 基于 Legado 规则：bookSource_瘦身版.json「MANHUA18」(customOrder 318)，搜索 /search?q={key}，目录 #chapterlist，图片 img@data-src（需 Referer）
 * 验证日期：2026-11-27（curl 实测：搜索“solo”有结果；详情 /webtoon/worn-and-torn-newbie 200；目录 221 条章节链接；章节页 42 张图，图 https://img02.manhwa18.cc/uploads/828/206/1-d08f8.jpg 带 Referer 200）
 */

/** @type {import('./_venera_.js')} */

const MANHUA18_BASE = "https://manhwa18.cc";
const MANHUA18_REFERER = MANHUA18_BASE + "/";
const MANHUA18_UA = "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";

/**
 * 解析作品卡片（搜索页、/webtoons 列表页通用 .manga-lists .bsx 结构）
 * <div class="bsx"><a href="/webtoon/{slug}" title="标题"><img data-src="封面"></a><h3><a href="/webtoon/{slug}">标题</a></h3>…
 */
function parseComicCard(card) {
    try {
        const a = card.querySelector("h3 a") || card.querySelector('a[href^="/webtoon/"]');
        if (!a) return null;
        const href = a.attributes["href"] || "";
        const m = href.match(/\/webtoon\/([^/]+)/);
        if (!m) return null;
        const id = m[1];
        const title = a.text.trim() || a.attributes["title"] || id;
        const img = card.querySelector("img");
        const cover = img ? (img.attributes["data-src"] || img.attributes["src"] || "") : "";
        return new Comic({
            id: id,
            title: title,
            cover: cover,
        });
    } catch (e) {
        return null;
    }
}

function parseComicList(doc) {
    const result = [];
    doc.querySelectorAll(".manga-lists .bsx").forEach((card) => {
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

class Manhua18 extends ComicSource {
    name = "MANHUA18";
    key = "manhua18";

    version = "1.0.0";
    minAppVersion = "1.4.6";

    url = "https://cdn.jsdelivr.net/gh/3176289965f-ai/my-venera-sources@main/manhua18.js";

    init() {}

    async getHtml(url) {
        const resp = await Network.get(url, {
            "User-Agent": MANHUA18_UA,
            "referer": MANHUA18_REFERER,
        });
        if (resp.status !== 200) throw new Error(resp.status);
        return resp.body;
    }

    /// explore：全部 /webtoons/{page}
    explore = [
        {
            title: "All Webtoons",
            type: "multiPageComicList",
            load: async (page) => {
                if (!page) page = 1;
                const html = await this.getHtml(`${MANHUA18_BASE}/webtoons/${page}`);
                const doc = new HtmlDocument(html);
                const comics = parseComicList(doc);
                const maxPage = parseMaxPage(doc);
                return { comics, maxPage };
            },
            loadNext: async (next) => {},
        },
    ];

    category = {
        title: "MANHUA18",
        parts: [
            {
                name: "分类",
                type: "fixed",
                categories: ["All Webtoons", "Manhwa Raw", "18+ Content", "Completed"],
                itemType: "category",
                categoryParams: ["/webtoons", "/raw", "/webtoon-genre/adult", "/completed"],
            },
        ],
        enableRankingPage: false,
    };

    categoryComics = {
        load: async (category, param, options, page) => {
            if (!page) page = 1;
            const html = await this.getHtml(`${MANHUA18_BASE}${param}/${page}`);
            const doc = new HtmlDocument(html);
            const comics = parseComicList(doc);
            const maxPage = parseMaxPage(doc);
            return { comics, maxPage };
        },
        optionList: [],
        ranking: null,
    };

    /// search：/search?q={key}
    search = {
        load: async (keyword, options, page) => {
            if (!page) page = 1;
            const kw = (keyword || "").trim();
            if (!kw) return { comics: [], maxPage: 1 };
            const url = `${MANHUA18_BASE}/search?q=${encodeURIComponent(kw)}`;
            const html = await this.getHtml(url);
            const doc = new HtmlDocument(html);
            const comics = parseComicList(doc);
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
            const url = `${MANHUA18_BASE}/webtoon/${id}`;
            const html = await this.getHtml(url);
            const doc = new HtmlDocument(html);

            // <title>Read {Title} Manhwa at Manhwa18CC</title>
            let title = id;
            const titleEl = doc.querySelector("title");
            if (titleEl) {
                title = titleEl.text.trim()
                    .replace(/^Read\s+/i, "")
                    .replace(/\s+Manhwa at Manhwa18CC$/i, "")
                    .replace(/\s+at Manhwa18CC$/i, "")
                    .trim() || id;
            }

            let cover = "";
            const ogImg = doc.querySelector('meta[property="og:image"]');
            if (ogImg) cover = ogImg.attributes["content"] || "";
            if (!cover) {
                const img = doc.querySelector('img[data-src*="/manga/"]');
                if (img) cover = img.attributes["data-src"] || "";
            }

            const chapters = new Map();
            doc.querySelectorAll("#chapterlist li a").forEach((a) => {
                const href = a.attributes["href"] || "";
                const m = href.match(/\/chapter-(\d+)/);
                if (!m) return;
                const name = a.text.trim() || `Chapter ${m[1]}`;
                chapters.set(`chapter-${m[1]}`, name);
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
            const url = `${MANHUA18_BASE}/webtoon/${comicId}/${epId}`;
            const html = await this.getHtml(url);
            const doc = new HtmlDocument(html);
            const images = [];
            doc.querySelectorAll("img[data-src]").forEach((img) => {
                const src = img.attributes["data-src"] || "";
                if (src && src.indexOf("http") === 0 && src.indexOf("/manga/") < 0) images.push(src);
            });
            return { images: images };
        },

        onImageLoad: (url, comicId, epId) => {
            return {
                url,
                headers: {
                    referer: MANHUA18_REFERER,
                },
            };
        },

        onThumbnailLoad: (url) => {
            return {
                url,
                headers: {
                    referer: MANHUA18_REFERER,
                },
            };
        },

        link: {
            domains: ["manhwa18.cc"],
            linkToId: (url) => {
                const m = url.match(/\/webtoon\/([^/]+)/);
                if (!m) throw new Error("Invalid manhua18 url");
                return m[1];
            },
        },
    };
}
