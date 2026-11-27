// 学外漫画 (www.xwmanhua.com) Venera 漫画源
// 版本: 1.0.0
// 基于 Legado 规则转制: Legado 源名“学外漫画”, bookSourceUrl https://www.xwmanhua.com (customOrder 271)
// 验证日期: 2026-11-27 (curl 实测)
//   搜索: GET /search?types=comic&searhword=海贼王 -> 200, 27KB, 标题“海贼王漫画搜索”,
//     18 条 dl.cls.alllist dt.col-lg-2 结果, 链接 /comic/{slug}/, 封面 res.taozi.icu
//   详情: GET /comic/haizeiwanghanghaiwang/ -> 200, 706KB,
//     章节 ul#ul_chapter1, 第 1099 话在列, 链接 /comic/{slug}/read-{n}.html
//   阅读: GET /comic/haizeiwanghanghaiwang/read-1105.html 与 read-1104.html -> 200,
//     均含 Dean Edwards 压缩 eval, 解包得 picTree (18 张 / 16 张), 与 Legado 规则
//     的 jsLib unpack + eval 逻辑一致
//   图片: read-1104 的 picTree 全是 res.taozi.icu 直链, 跟随 302 后实测 200
//     image/jpeg 184KB; 但 read-1105 的 picTree 全是 shimolife 签名直链,
//     x-expires=1701669128(2023-12-04)已过期, 实测 403
// 已知局限:
//   1. 图片地址按章节走不同 CDN, 部分章节(如 read-1105)的签名已过期、图打不开,
//      部分章节(如 read-1104)正常; 这是站方数据问题, 换源/等站方更新才能解决。
//      本源按 Legado 规则现场解包取图, 能开的章节正常显示。
//   2. 首页 explore 解析 li.col-sm-2 卡片(绝对地址 /comic/{slug}/), 与搜索页的
//      dt.col-lg-2 结构不同, 已按首页实测 HTML(173KB)写选择器, 未逐项核对卡片字段。
class Xuewai extends ComicSource {
    name = "学外漫画"
    key = "xuewai"
    version = "1.0.0"
    minAppVersion = "1.6.0"
    url = "https://cdn.jsdelivr.net/gh/3176289965f-ai/my-venera-sources@main/xuewai.js"

    static baseUrl = "https://www.xwmanhua.com"
    static userAgent = "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0 Mobile Safari/537.36"

    headers(referer) {
        const h = {
            "User-Agent": Xuewai.userAgent,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
            "Accept-Language": "zh-CN,zh;q=0.9",
            "Accept-Encoding": "gzip, deflate",
            "Connection": "keep-alive",
            "Upgrade-Insecure-Requests": "1",
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
        if (u.startsWith("/")) return Xuewai.baseUrl + u
        return u
    }

    // 章节页含 Dean Edwards 压缩 eval: eval(function(p,a,c,k,e,d){...}(...))
    // 解包后是 var picTree=[...]; 不用 eval 取变量, 而是取解包结果的完成值
    // (class 方法为严格模式, 直接 eval 声明的 var 读不到, 取完成值可绕过)
    unpackChapterImages(html) {
        const m = html.match(/eval\(function\(p,a,c,k,e,d\)[\s\S]*?\.split\('\|'\),0,\{\}\)\)/)
        if (!m) return []
        const inner = m[0].slice(5, -1)
        let unpacked
        try {
            unpacked = eval("(" + inner + ")")
        } catch (e) {
            return []
        }
        if (typeof unpacked !== "string") return []
        try {
            const arr = eval(unpacked + "\npicTree")
            return Array.isArray(arr) ? arr.map(u => String(u)) : []
        } catch (e) {
            return []
        }
    }

    parseSearchList(doc) {
        const comics = []
        for (const dt of Array.from(doc.querySelectorAll("dl.cls.alllist dt.col-lg-2"))) {
            const a = dt.querySelector(".ti a") || dt.querySelector("a")
            if (!a) continue
            const href = a.attributes.href || ""
            const slugM = href.match(/\/comic\/([a-zA-Z0-9]+)\/?$/)
            if (!slugM) continue
            const img = dt.querySelector("img")
            comics.push(new Comic({
                id: slugM[1],
                title: (a.text || "").trim().replace(/漫画$/, ""),
                cover: this.absoluteUrl(img ? (img.attributes["data-original"] || img.attributes.src || "") : ""),
                subTitle: ""
            }))
        }
        return comics
    }

    explore = [
        {
            title: "学外漫画",
            type: "singlePageWithMultiPart",
            load: async () => {
                const res = await this.requestPage(Xuewai.baseUrl + "/", this.headers(Xuewai.baseUrl + "/"))
                const doc = new HtmlDocument(res.body)
                try {
                    const comics = []
                    for (const li of Array.from(doc.querySelectorAll("li.col-sm-2"))) {
                        let link = null, img = null
                        for (const a of Array.from(li.querySelectorAll("a"))) {
                            const href = a.attributes.href || ""
                            if (href.indexOf("/comic/") >= 0 && href.indexOf("/read-") < 0) { link = a; break }
                        }
                        img = li.querySelector("img")
                        if (!link) continue
                        const slugM = String(link.attributes.href).match(/\/comic\/([a-zA-Z0-9]+)\/?$/)
                        if (!slugM) continue
                        const title = (img && img.attributes.alt) ? img.attributes.alt : (link.text || "").trim()
                        comics.push(new Comic({
                            id: slugM[1],
                            title: title.replace(/漫画$/, ""),
                            cover: this.absoluteUrl(img ? (img.attributes["data-original"] || img.attributes.src || "") : ""),
                            subTitle: ""
                        }))
                    }
                    return comics.length > 0 ? { "热门漫画": comics } : {}
                } finally {
                    doc.dispose()
                }
            }
        }
    ]

    search = {
        load: async (keyword, options, page) => {
            const res = await this.requestPage(
                `${Xuewai.baseUrl}/search?types=comic&searhword=${encodeURIComponent(keyword)}`,
                this.headers(Xuewai.baseUrl + "/"))
            const doc = new HtmlDocument(res.body)
            try {
                return { comics: this.parseSearchList(doc), maxPage: 1 }
            } finally {
                doc.dispose()
            }
        }
    }

    comic = {
        loadInfo: async (id) => {
            const res = await this.requestPage(`${Xuewai.baseUrl}/comic/${encodeURIComponent(id)}/`, this.headers(Xuewai.baseUrl + "/"))
            const html = res.body
            const doc = new HtmlDocument(html)
            try {
                const titleEl = doc.querySelector(".bookname")
                const introEl = doc.querySelector(".ms")
                const kindEls = Array.from(doc.querySelectorAll(".tags a"))
                const tags = {}
                if (kindEls.length > 0) {
                    tags["分类"] = kindEls.map(e => e.text.trim()).filter(Boolean)
                }
                // 章节: ul#ul_chapter1 li a, href 为 /comic/{slug}/read-{n}.html
                // 页面为降序(最新在前), 倒转为升序
                const eps = []
                for (const a of Array.from(doc.querySelectorAll("ul#ul_chapter1 li a"))) {
                    const href = a.attributes.href || ""
                    const m = href.match(/\/read-(\d+)\.html$/)
                    const name = (a.text || "").trim()
                    if (m && name) eps.push([m[1], name])
                }
                eps.reverse()
                const chapters = new Map()
                if (eps.length > 0) {
                    const epMap = new Map()
                    for (const [epId, epName] of eps) epMap.set(epId, epName)
                    chapters.set("章节", epMap)
                }
                // 封面取详情页第一张非 logo 图: 优先 data-original 带 res.taozi.icu 的
                let cover = ""
                for (const img of Array.from(doc.querySelectorAll("img"))) {
                    const src = img.attributes["data-original"] || img.attributes.src || ""
                    if (src.indexOf("res.taozi.icu") >= 0) { cover = this.absoluteUrl(src); break }
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
            const res = await this.requestPage(
                `${Xuewai.baseUrl}/comic/${encodeURIComponent(comicId)}/read-${encodeURIComponent(epId)}.html`,
                this.headers(`${Xuewai.baseUrl}/comic/${encodeURIComponent(comicId)}/`))
            return { images: this.unpackChapterImages(res.body) }
        },
        onImageLoad: (imageKey, comicId, ep) => {
            return {
                url: imageKey,
                headers: {
                    "User-Agent": Xuewai.userAgent,
                    "Referer": `${Xuewai.baseUrl}/comic/${encodeURIComponent(comicId)}/read-${encodeURIComponent(ep)}.html`,
                    "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
                    "Accept-Language": "zh-CN,zh;q=0.9",
                }
            }
        },
        onThumbnailLoad: (imageKey) => {
            return {
                headers: {
                    "User-Agent": Xuewai.userAgent,
                    "Referer": Xuewai.baseUrl + "/",
                    "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
                    "Accept-Language": "zh-CN,zh;q=0.9",
                }
            }
        }
    }
}
