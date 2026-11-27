// 奈奈 (暖暖社 / www.nncos.com) Venera 漫画源
// 版本: 1.0.0
// 基于 Legado 规则「奈奈」(bookSourceUrl https://www.nncos.com/) 转换，验证日期 2026-11-27
//   站点是 COS 图集站（暖暖社）：每篇帖子 = 一套 COS 图集；搜索 ?s=关键词 返回 article.post-item
//   详情 /{id}.html：h1 标题，正文图片在 article.post-content 内（img.nncos.com/*.webp）
//   Legado 的 ruleToc（tag.h1 / article-title）已失效：详情页只有一个 h1、无 article-title 类，
//   每篇帖子无子章节——Venera 里每篇帖子映射为一章「图集」
// 证据（2026-11-27，curl 实测）：
//   搜索 海贼王：200，4 条结果（Byoru–海贼王 妮可·罗宾 等）；&page=2 返回同样 4 条，搜索无分页
//   详情 /16492.html：200，h1 标题，article.post-content 内 29 张图
//   图片 https://img.nncos.com/2026/07/26/hj2TJgex.webp：200，339KB，image/webp
//   探索 /month.html：200，99 篇；分类 /ac：200
class NaiNai extends ComicSource {
    name = "奈奈"
    key = "nainai"
    version = "1.0.0"
    minAppVersion = "1.4.0"
    url = "https://cdn.jsdelivr.net/gh/3176289965f-ai/my-venera-sources@main/nainai.js"

    static baseUrl = "https://www.nncos.com"
    static userAgent = "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Mobile Safari/537.36"

    headers(referer) {
        const h = {
            "User-Agent": NaiNai.userAgent,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
            "Accept-Language": "zh-CN,zh;q=0.9",
            "Accept-Encoding": "gzip, deflate",
            "Connection": "keep-alive",
            "Upgrade-Insecure-Requests": "1",
        }
        if (referer) {
            h["Referer"] = referer
        }
        return h
    }

    // 列表卡片: article.post-item (h2.entry-title a 标题+链接, a.media-img[data-bg] 封面)
    parseArticle(article) {
        if (!article) return null
        const link = article.querySelector("h2.entry-title a")
        if (!link) return null
        const href = String(link.attributes.href || "")
        const m = href.match(/\/(\d+)\.html/)
        if (!m) return null
        const media = article.querySelector("a.media-img")
        const cover = media ? (media.attributes["data-bg"] || "") : ""
        return new Comic({
            id: m[1],
            title: link.text.trim(),
            cover: cover,
            subTitle: ""
        })
    }

    parseArticleList(doc) {
        const comics = []
        for (const a of Array.from(doc.querySelectorAll("article.post-item"))) {
            const c = this.parseArticle(a)
            if (c) comics.push(c)
        }
        return comics
    }

    explore = [
        {
            title: "奈奈",
            type: "singlePageWithMultiPart",
            load: async () => {
                const result = {}
                for (const [section, path] of [["本月热门", "/month.html"], ["亚洲萌娘", "/ac"]]) {
                    const res = await Network.get(NaiNai.baseUrl + path, this.headers(NaiNai.baseUrl + "/"))
                    const doc = new HtmlDocument(res.body)
                    try {
                        const comics = this.parseArticleList(doc)
                        if (comics.length > 0) result[section] = comics
                    } finally {
                        doc.dispose()
                    }
                }
                return result
            }
        }
    ]

    search = {
        load: async (keyword, options, page) => {
            const res = await Network.get(`${NaiNai.baseUrl}/?s=${encodeURIComponent(keyword)}`, this.headers(NaiNai.baseUrl + "/"))
            const doc = new HtmlDocument(res.body)
            try {
                return {
                    comics: this.parseArticleList(doc),
                    maxPage: 1 // 搜索无分页：第2页返回同样结果
                }
            } finally {
                doc.dispose()
            }
        }
    }

    comic = {
        loadInfo: async (id) => {
            const res = await Network.get(`${NaiNai.baseUrl}/${encodeURIComponent(id)}.html`, this.headers(NaiNai.baseUrl + "/"))
            const doc = new HtmlDocument(res.body)
            try {
                const titleEl = doc.querySelector("h1")
                const coverEl = doc.querySelector("article.post-content img")
                // 每篇帖子就是一套图集，无子章节
                const eps = new Map()
                eps.set(id, "图集")
                const chapters = new Map()
                chapters.set("图集", eps)
                return new ComicDetails({
                    title: titleEl ? titleEl.text.trim() : id,
                    cover: coverEl ? (coverEl.attributes.src || "") : "",
                    description: "",
                    tags: {},
                    chapters: chapters,
                    subId: id
                })
            } finally {
                doc.dispose()
            }
        },
        loadEp: async (comicId, epId) => {
            const res = await Network.get(`${NaiNai.baseUrl}/${encodeURIComponent(comicId)}.html`, this.headers(NaiNai.baseUrl + "/"))
            const doc = new HtmlDocument(res.body)
            try {
                const images = []
                for (const img of Array.from(doc.querySelectorAll("article.post-content img"))) {
                    const u = img.attributes.src
                    if (u) images.push(u)
                }
                return { images: images }
            } finally {
                doc.dispose()
            }
        },
        onImageLoad: (imageKey, comicId, ep) => {
            return {
                url: imageKey,
                headers: {
                    "User-Agent": NaiNai.userAgent,
                    "Referer": `${NaiNai.baseUrl}/${encodeURIComponent(comicId)}.html`,
                    "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
                    "Accept-Language": "zh-CN,zh;q=0.9",
                }
            }
        },
        onThumbnailLoad: (imageKey) => {
            return {
                headers: {
                    "User-Agent": NaiNai.userAgent,
                    "Referer": NaiNai.baseUrl + "/",
                    "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
                    "Accept-Language": "zh-CN,zh;q=0.9",
                }
            }
        }
    }
}
