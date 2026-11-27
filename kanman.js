// 看漫画 (m.kanman.com) Venera 漫画源
// 版本: 1.0.0
// 基于 Legado 同站 4 条规则合为 1 个源（以 API 版「彩绘漫画（优）/看漫画吧」为主，
// HTML 版「爱看漫画/看漫画吧（优）」作参考），验证日期 2026-11-27
//   搜索/目录/章节均为 JSON API（注意搜索接口拼写就是 serachcomic）；详情页 HTML 只取 OG 标签
// 证据（2026-11-27，curl 实测）：
//   搜索 海贼王：200，14 条结果（某天成为王的女儿 107477 等）
//   目录 comic 107477：75 章（接口倒序返回、最新在前，源内已反转为阅读顺序）
//   章节 第1话：21 张图，hw-chapter2.kaimanhua.com，URL 带 auth_key 签名（有时效，每次打开章节重新拉取）
//   图片 HEAD：200，183KB，image/webp；封面 image.yqmh.com/mh/107477.jpg-300x400.webp：200，42KB
//   详情页 OG：og:title / og:description / og:novel:author / og:novel:category 均有
//   探索 getsortlist orderby=click：200
class KanMan extends ComicSource {
    name = "看漫画"
    key = "kanman"
    version = "1.0.0"
    minAppVersion = "1.4.0"
    url = "https://cdn.jsdelivr.net/gh/3176289965f-ai/my-venera-sources@main/kanman.js"

    static apiBase = "https://m.kanman.com"
    static userAgent = "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Mobile Safari/537.36"
    static apiParams = "product_id=1&productname=kmh&platformname=wap"

    headers(referer) {
        const h = {
            "User-Agent": KanMan.userAgent,
            "Accept": "application/json, text/html, */*; q=0.01",
            "Accept-Language": "zh-CN,zh;q=0.9",
            "Accept-Encoding": "gzip, deflate",
            "Connection": "keep-alive",
        }
        if (referer) {
            h["Referer"] = referer
        }
        return h
    }

    parseSearchComic(c) {
        const id = String(c.comic_id || "")
        if (!id) return null
        return new Comic({
            id: id,
            title: (c.comic_name || "").trim(),
            cover: `https://image.yqmh.com/mh/${id}.jpg-300x400.webp`,
            subTitle: (c.latest_cartoon_topic_name || c.last_chapter_name || "").trim()
        })
    }

    parseSortList(json) {
        const list = Array.isArray(json.data) ? json.data : ((json.data && json.data.data) || [])
        const comics = []
        for (const c of list) {
            const comic = this.parseSearchComic(c)
            if (comic) comics.push(comic)
        }
        return comics
    }

    explore = [
        {
            title: "看漫画",
            type: "singlePageWithMultiPart",
            load: async () => {
                const result = {}
                for (const [section, orderby] of [["人气", "click"], ["最新更新", "date"]]) {
                    const res = await Network.get(`${KanMan.apiBase}/api/getsortlist/?comic_sort=&orderby=${orderby}&search_type=&search_key=&page=1&size=12`, this.headers(KanMan.apiBase + "/"))
                    const comics = this.parseSortList(JSON.parse(res.body))
                    if (comics.length > 0) result[section] = comics
                }
                return result
            }
        }
    ]

    search = {
        load: async (keyword, options, page) => {
            const res = await Network.get(`${KanMan.apiBase}/api/serachcomic/?${KanMan.apiParams}&serachKey=${encodeURIComponent(keyword)}&topNumber=10`, this.headers(KanMan.apiBase + "/"))
            const json = JSON.parse(res.body)
            const list = Array.isArray(json.data) ? json.data : ((json.data && json.data.data) || [])
            const comics = []
            for (const c of list) {
                const comic = this.parseSearchComic(c)
                if (comic) comics.push(comic)
            }
            return {
                comics: comics,
                maxPage: 1 // 接口固定 topNumber=10，无分页
            }
        }
    }

    comic = {
        loadInfo: async (id) => {
            // 详情页 OG 标签：标题/简介/作者/分类/封面
            const res = await Network.get(`${KanMan.apiBase}/${encodeURIComponent(id)}/`, this.headers(KanMan.apiBase + "/"))
            const doc = new HtmlDocument(res.body)
            let title = id, cover = "", description = ""
            const tags = {}
            try {
                const meta = (prop) => {
                    const el = doc.querySelector(`[property="${prop}"]`)
                    return el ? (el.attributes.content || "") : ""
                }
                title = meta("og:title") || id
                description = meta("og:description") || ""
                const author = meta("og:novel:author")
                const category = meta("og:novel:category")
                const ogImage = meta("og:image")
                if (author) tags["作者"] = [author]
                if (category) tags["分类"] = category.split(/\s+/).filter(Boolean)
                if (ogImage) cover = ogImage.startsWith("//") ? "https:" + ogImage : ogImage
            } finally {
                doc.dispose()
            }
            // 目录 API（倒序返回最新在前，反转为阅读顺序）
            const chRes = await Network.get(`${KanMan.apiBase}/api/getchapterlist?${KanMan.apiParams}&comic_id=${encodeURIComponent(id)}`, this.headers(KanMan.apiBase + "/"))
            const chJson = JSON.parse(chRes.body)
            const list = chJson.data || []
            const eps = new Map()
            for (let i = list.length - 1; i >= 0; i--) {
                const c = list[i]
                const newid = String(c.chapter_newid || "")
                if (newid) eps.set(newid, (c.chapter_name || "").trim())
            }
            const chapters = new Map()
            if (eps.size > 0) chapters.set("章节", eps)
            return new ComicDetails({
                title: title,
                cover: cover,
                description: description,
                tags: tags,
                chapters: chapters,
                subId: id
            })
        },
        loadEp: async (comicId, epId) => {
            const res = await Network.get(`${KanMan.apiBase}/api/getchapterinfov2?${KanMan.apiParams}&comic_id=${encodeURIComponent(comicId)}&chapter_newid=${encodeURIComponent(epId)}&isWebp=1&quality=low`, this.headers(KanMan.apiBase + "/"))
            const json = JSON.parse(res.body)
            const imgList = (json.data && json.data.current_chapter && json.data.current_chapter.chapter_img_list) || ""
            const images = String(imgList).split("\n").map(s => s.trim()).filter(Boolean)
            return { images: images }
        },
        onImageLoad: (imageKey, comicId, ep) => {
            return {
                url: imageKey,
                headers: {
                    "User-Agent": KanMan.userAgent,
                    "Referer": `${KanMan.apiBase}/${encodeURIComponent(comicId)}/`,
                    "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
                    "Accept-Language": "zh-CN,zh;q=0.9",
                }
            }
        },
        onThumbnailLoad: (imageKey) => {
            return {
                headers: {
                    "User-Agent": KanMan.userAgent,
                    "Referer": KanMan.apiBase + "/",
                    "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
                    "Accept-Language": "zh-CN,zh;q=0.9",
                }
            }
        }
    }
}
