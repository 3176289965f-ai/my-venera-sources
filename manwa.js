/**
 * 漫蛙 — Venera 源
 * 站域名：https://manwauu.cc（Legado 规则写的是 https://www.manwaku.com/，2026-11-27 实测 301 跳转到 manwauu.cc）
 * 基于 Legado 规则：bookSource_瘦身版.json「漫蛙」(customOrder 316)，搜索走 /api/search JSON 接口，目录走 #chapter-grid-container，图片走 /api/comic/image/{chapterId}
 * 验证日期：2026-11-27（curl 实测：搜索“鬼灭之刃”返回 2808 条；详情 /comic/133402 200；目录 1 话；图片接口返回图片列表；图 https://tu.mhttu.cc/en_images/202602/133402/1933807/1.jpg 200；封面 200）
 * 注意：搜索关键词不能为空（空串返回 400），explore 用首页 #comicList 推荐列表。
 */

/** @type {import('./_venera_.js')} */

const MANWA_BASE = "https://manwauu.cc";
const MANWA_UA = "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";

function parseSearchItem(item) {
    let id = "";
    if (item.url) {
        let m = item.url.match(/\/comic\/(\d+)/);
        if (m) id = m[1];
    }
    if (!id && item.id) id = String(item.id);
    if (!id) return null;
    let tags = [];
    if (item.tags) {
        tags = String(item.tags).split(",").map(t => t.trim()).filter(Boolean);
    }
    return new Comic({
        id: id,
        title: item.title || id,
        subTitle: item.author || "",
        cover: item.cover || "",
        tags: tags,
        description: item.description || "",
    });
}

class Manwa extends ComicSource {
    name = "漫蛙";
    key = "manwa";

    version = "1.0.0";
    minAppVersion = "1.4.6";

    url = "https://cdn.jsdelivr.net/gh/3176289965f-ai/my-venera-sources@main/manwa.js";

    init() {}

    async getJson(url) {
        const resp = await Network.get(url, { "User-Agent": MANWA_UA });
        if (resp.status !== 200) throw new Error(resp.status);
        return JSON.parse(resp.body);
    }

    async getHtml(url) {
        const resp = await Network.get(url, { "User-Agent": MANWA_UA });
        if (resp.status !== 200) throw new Error(resp.status);
        return resp.body;
    }

    /// explore：首页热门推荐（#comicList）
    explore = [
        {
            title: "漫蛙",
            type: "multiPageComicList",
            load: async (page) => {
                if (page && page !== 1) return { comics: [], maxPage: 1 };
                const html = await this.getHtml(MANWA_BASE + "/");
                const doc = new HtmlDocument(html);
                const comics = [];
                doc.querySelectorAll("#comicList .item").forEach((item) => {
                    try {
                        const a = item.querySelector('a[href^="/comic/"]');
                        if (!a) return;
                        const href = a.attributes["href"];
                        const m = href.match(/\/comic\/(\d+)/);
                        if (!m) return;
                        const titleEl = item.querySelector(".title");
                        const thumb = item.querySelector(".thumb_img");
                        const descEl = item.querySelector(".desc");
                        let subTitle = "";
                        let tags = [];
                        if (descEl) {
                            const desc = descEl.text.trim();
                            const parts = desc.split("|");
                            subTitle = parts[0] ? parts[0].trim() : "";
                            if (parts[1]) tags = parts[1].split(",").map(t => t.trim()).filter(Boolean);
                        }
                        comics.push(new Comic({
                            id: m[1],
                            title: titleEl ? titleEl.text.trim() : m[1],
                            subTitle: subTitle,
                            cover: thumb ? (thumb.attributes["data-src"] || "") : "",
                            tags: tags,
                        }));
                    } catch (e) {}
                });
                return { comics, maxPage: 1 };
            },
            loadNext: async (next) => {},
        },
    ];

    category = {
        title: "漫蛙",
        parts: [],
        enableRankingPage: false,
    };

    categoryComics = {
        load: async (category, param, options, page) => {
            return { comics: [], maxPage: 1 };
        },
        optionList: [],
        ranking: null,
    };

    /// search：/api/search?type=mh&page={page}&pageSize=20&keyword={key}
    search = {
        load: async (keyword, options, page) => {
            if (!page) page = 1;
            const kw = (keyword || "").trim();
            if (!kw) return { comics: [], maxPage: 1 };
            const url = `${MANWA_BASE}/api/search?type=mh&page=${page}&pageSize=20&keyword=${encodeURIComponent(kw)}`;
            const json = await this.getJson(url);
            const list = (json.data && json.data.list) || [];
            const total = (json.data && json.data.total) || 0;
            const comics = [];
            list.forEach((item) => {
                const c = parseSearchItem(item);
                if (c) comics.push(c);
            });
            const maxPage = total > 0 ? Math.ceil(total / 20) : 1;
            return { comics, maxPage };
        },
        loadNext: async (keyword, options, next) => {},
        optionList: [],
        enableTagsSuggestions: false,
    };

    /// 单本漫画
    comic = {
        loadInfo: async (id) => {
            const url = `${MANWA_BASE}/comic/${id}`;
            const html = await this.getHtml(url);
            const doc = new HtmlDocument(html);

            const titleEl = doc.querySelector(".comic-info h2");
            const title = titleEl ? titleEl.text.trim() : id;

            let author = "";
            const authorEl = doc.querySelector(".comic-meta a span");
            if (authorEl) author = authorEl.text.trim();

            let tags = [];
            doc.querySelectorAll(".comic-tags-more a span").forEach((el) => {
                const t = el.text.trim();
                if (t) tags.push(t);
            });

            let cover = "";
            const coverEl = doc.querySelector(".comic-info img");
            if (coverEl) cover = coverEl.attributes["src"] || coverEl.attributes["data-src"] || "";

            const tagsMap = new Map();
            if (author) tagsMap.set("作者", [author]);
            if (tags.length) tagsMap.set("标签", tags);

            const chapters = new Map();
            doc.querySelectorAll("#chapter-grid-container a").forEach((a) => {
                const href = a.attributes["href"] || "";
                const parts = href.split("/");
                // /comic/{comicId}/{chapterId}
                const chapterId = parts[3] || "";
                const name = a.attributes["data-title"] || a.text.trim() || chapterId;
                if (chapterId) chapters.set(chapterId, name);
            });

            return new ComicDetails({
                title: title,
                cover: cover,
                tags: tagsMap,
                chapters: chapters,
                url: url,
            });
        },

        loadEp: async (comicId, epId) => {
            const url = `${MANWA_BASE}/api/comic/image/${epId}?count=true`;
            const json = await this.getJson(url);
            const images = ((json.data && json.data.images) || []).map((im) => im.url).filter(Boolean);
            return { images: images };
        },

        link: {
            domains: ["manwauu.cc", "manwaku.com", "www.manwaku.com"],
            linkToId: (url) => {
                const m = url.match(/\/comic\/(\d+)/);
                if (!m) throw new Error("Invalid manwa url");
                return m[1];
            },
        },
    };
}
