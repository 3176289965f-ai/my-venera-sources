// 知音漫客 (m.zymk.cn) Venera 漫画源
// 版本: 1.0.0
// 基于 Legado 规则转制: Legado 源名“知音漫客”, bookSourceUrl https://m.zymk.cn (customOrder 269)
// 验证日期: 2026-11-27 (curl 实测)
//   搜索 API: GET /apinew/getsortlist_new?client-type=wap&key=凤逆天下&page=1&sort=click
//     -> 200, {"status":0,"data":{"page":{"total_num":3,"comic_list":[{"comic_id":101,
//        "comic_name":"凤逆天下","last_chapter":{"id":"434914","name":"592话 亲手斩断8"}}]}}}
//     (搜“斗罗大陆/海贼王”返回空列表是正确的——这两部不在知音漫客站内)
//   浏览 API: 同接口无 key -> total 3853; type=5_p1(热血) -> total 842, 分类过滤有效
//   详情: GET /101/ -> 200, h1.name=凤逆天下, 章节 ul.chapterlist
//   阅读: GET /101/168663.html -> 200, dr_original + end_var齐全
//   图片: 阅读页内嵌 baidutmpArr 给出 mhpic.yyhao.com 直链, 实测 200 image/jpeg 103KB
// 已知局限:
//   1. 详情页 HTML 只含 28 条章节(前 20 话 + 7 条通知); 该漫画 API 显示最新 592 话,
//      其余章节不在详情页 HTML 里, 页内 JS 也无章节列表接口(疑似需登录/付费, 站内有
//      /apinew/get_purchased_chapters 接口), 目录不全是站方限制, Legado 源同样如此。
//   2. 图片首选 baidutmpArr 的 yyhao 直链(已验证); 兜底按 Legado 规则拼
//      mhpic.zymkcdn.com 的 URL, 该 host 在 VM 侧被代理掐断(Empty reply)无法验证,
//      真机上可能正常。
//   3. 搜索封面 URL 按 9 位补零分段拼接(101 -> 000/000/101.jpg-300x400, 与详情页
//      实测一致), 大于 999 的 id 未逐一验证, 封面错只影响缩略图, 详情页会取真实封面。
class Zymk extends ComicSource {
    name = "知音漫客"
    key = "zymk"
    version = "1.0.0"
    minAppVersion = "1.6.0"
    url = "https://cdn.jsdelivr.net/gh/3176289965f-ai/my-venera-sources@main/zymk.js"

    static baseUrl = "https://m.zymk.cn"
    static userAgent = "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0 Mobile Safari/537.36"
    static categories = [["热血", "5"], ["搞笑", "6"], ["玄幻", "7"], ["生活", "8"], ["恋爱", "9"], ["动作", "10"], ["科幻", "11"], ["战争", "12"], ["悬疑", "13"], ["恐怖", "14"], ["校园", "15"], ["历史", "16"], ["穿越", "17"], ["体育", "19"], ["都市", "20"], ["漫改", "22"], ["修真", "53"], ["霸总", "62"], ["古风", "63"], ["游戏", "64"], ["真人", "65"], ["武侠", "66"]]

    headers(referer) {
        const h = {
            "User-Agent": Zymk.userAgent,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,application/json,*/*;q=0.8",
            "Accept-Language": "zh-CN,zh;q=0.9",
            "Accept-Encoding": "gzip, deflate",
            "Connection": "keep-alive",
        }
        if (referer) h["Referer"] = referer
        return h
    }

    async requestPage(url, headers, retries = 3) {
        let lastStatus = 0
        for (let i = 0; i < retries; i++) {
            try {
                const res = await Network.get(url, headers)
                lastStatus = res.status
                if (res.status === 403 || res.status >= 500) {
                    await new Promise((r) => setTimeout(r, 2000 * (i + 1)))
                    continue
                }
                return res
            } catch (e) {
                await new Promise((r) => setTimeout(r, 2000 * (i + 1)))
            }
        }
        throw `Invalid status code: ${lastStatus || "network error"}`
    }

    absoluteUrl(u) {
        if (!u) return ""
        u = String(u).trim()
        if (u.startsWith("//")) return "https:" + u
        if (u.startsWith("/")) return Zymk.baseUrl + u
        return u
    }

    // 封面: chapter-cover.yyhao.com/file/cover/{3位}/{3位}/{id}.jpg-300x400
    // id 补零到 9 位再分段, 101 -> 000/000/101 (与详情页实测一致)
    coverUrlForId(id) {
        const s = String(id).padStart(9, "0")
        return `https://chapter-cover.yyhao.com/file/cover/${s.slice(0, 3)}/${s.slice(3, 6)}/${id}.jpg-300x400`
    }

    parseApiList(json) {
        let data
        try { data = JSON.parse(json) } catch (e) { return { comics: [], maxPage: 1 } }
        const page = (data && data.data && data.data.page) || {}
        const list = page.comic_list || []
        const comics = []
        for (const c of list) {
            if (!c.comic_id) continue
            const last = c.last_chapter || {}
            comics.push(new Comic({
                id: String(c.comic_id),
                title: c.comic_name || String(c.comic_id),
                cover: this.coverUrlForId(c.comic_id),
                subTitle: last.name || ""
            }))
        }
        return { comics: comics, maxPage: page.total_page || 1 }
    }

    explore = [
        {
            title: "知音漫客",
            type: "singlePageWithMultiPart",
            load: async () => {
                const res = await this.requestPage(
                    `${Zymk.baseUrl}/apinew/getsortlist_new?client-type=wap&sort=click&page=1`,
                    this.headers(Zymk.baseUrl + "/"))
                const r = this.parseApiList(res.body)
                return r.comics.length > 0 ? { "热门漫画": r.comics } : {}
            }
        }
    ]

    category = {
        title: "知音漫客",
        parts: [
            {
                name: "分类",
                type: "fixed",
                categories: Zymk.categories.map(e => e[0]),
                categoryParams: Zymk.categories.map(e => e[1]),
                itemType: "category"
            }
        ]
    }

    categoryComics = {
        load: async (category, param, options, page) => {
            const res = await this.requestPage(
                `${Zymk.baseUrl}/apinew/getsortlist_new?client-type=wap&type=${param}_p${page}&sort=click&page=${page}`,
                this.headers(Zymk.baseUrl + "/"))
            return this.parseApiList(res.body)
        }
    }

    search = {
        load: async (keyword, options, page) => {
            const res = await this.requestPage(
                `${Zymk.baseUrl}/apinew/getsortlist_new?client-type=wap&key=${encodeURIComponent(keyword)}&sort=click&page=${page}`,
                this.headers(Zymk.baseUrl + "/"))
            return this.parseApiList(res.body)
        }
    }

    comic = {
        loadInfo: async (id) => {
            const res = await this.requestPage(`${Zymk.baseUrl}/${encodeURIComponent(id)}/`, this.headers(Zymk.baseUrl + "/"))
            const html = res.body
            const doc = new HtmlDocument(html)
            try {
                const titleEl = doc.querySelector("h1.name")
                const introEl = doc.querySelector(".content")
                const authorEl = doc.querySelector(".author")
                let cover = ""
                for (const img of Array.from(doc.querySelectorAll("img"))) {
                    const src = img.attributes.src || img.attributes["data-src"] || ""
                    if (src.indexOf("chapter-cover") >= 0) { cover = this.absoluteUrl(src); break }
                }
                if (!cover) cover = this.coverUrlForId(id)
                const tags = {}
                if (authorEl) {
                    const t = authorEl.text.replace(/\s+/g, " ").trim()
                    if (t) tags["作者"] = [t]
                }
                const kindEls = Array.from(doc.querySelectorAll(".tags a"))
                if (kindEls.length > 0) {
                    tags["分类"] = kindEls.map(e => e.text.trim()).filter(Boolean)
                }
                // 章节: ul.chapterlist li a.chapterBtn, href 为相对路径 "433822.html"
                // 页面为降序(最新在前), 倒转为升序; 注意详情页只含前 20 话 + 通知(见文件头)
                const eps = []
                for (const a of Array.from(doc.querySelectorAll("ul.chapterlist li a.chapterBtn"))) {
                    const href = a.attributes.href || ""
                    const m = href.match(/(\d+)\.html$/)
                    const name = (a.attributes.title || a.text || "").trim()
                    if (m && name) eps.push([m[1], name])
                }
                eps.reverse()
                const chapters = new Map()
                if (eps.length > 0) {
                    const epMap = new Map()
                    for (const [epId, epName] of eps) epMap.set(epId, epName)
                    chapters.set("章节", epMap)
                }
                return new ComicDetails({
                    title: titleEl ? titleEl.text.trim() : id,
                    cover: cover,
                    description: introEl ? introEl.text.trim() : "",
                    tags: tags,
                    chapters: chapters,
                    subId: id
                })
            } finally {
                doc.dispose()
            }
        },
        loadEp: async (comicId, epId) => {
            const url = `${Zymk.baseUrl}/${encodeURIComponent(comicId)}/${encodeURIComponent(epId)}.html`
            const res = await this.requestPage(url, this.headers(`${Zymk.baseUrl}/${encodeURIComponent(comicId)}/`))
            const html = res.body
            // 首选阅读页内嵌的 baidutmpArr (mhpic.yyhao.com 直链, 已验证 200)
            const arrM = html.match(/baidutmpArr:'(\[.*?\])'/)
            if (arrM) {
                try {
                    const list = JSON.parse(arrM[1])
                    if (Array.isArray(list) && list.length > 0) {
                        return { images: list.map(u => encodeURI(String(u))) }
                    }
                } catch (e) { /* 掉到兜底 */ }
            }
            // 兜底: 按 Legado 规则用 dr_original + end_var 拼 mhpic.zymkcdn.com
            const origM = html.match(/dr_original:"([^"]+)"/)
            const endM = html.match(/end_var:(\d+)/)
            if (origM && endM) {
                const host = "http://mhpic.zymkcdn.com/comic/"
                const total = parseInt(endM[1])
                const images = []
                for (let i = 1; i <= total; i++) {
                    images.push(encodeURI(host + origM[1] + i + ".jpg-zymk.high.webp"))
                }
                return { images: images }
            }
            return { images: [] }
        },
        onImageLoad: (imageKey, comicId, ep) => {
            return {
                url: imageKey,
                headers: {
                    "User-Agent": Zymk.userAgent,
                    "Referer": `${Zymk.baseUrl}/${encodeURIComponent(comicId)}/${encodeURIComponent(ep)}.html`,
                    "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
                    "Accept-Language": "zh-CN,zh;q=0.9",
                }
            }
        },
        onThumbnailLoad: (imageKey) => {
            return {
                headers: {
                    "User-Agent": Zymk.userAgent,
                    "Referer": Zymk.baseUrl + "/",
                    "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
                    "Accept-Language": "zh-CN,zh;q=0.9",
                }
            }
        }
    }
}
