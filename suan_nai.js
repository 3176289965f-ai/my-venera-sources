// 酸奶漫画 (m.1kkk.com) Venera 漫画源
// 版本: 1.0.0
// 基于 Legado 规则转制: Legado 源名“酸奶漫画”, bookSourceUrl https://m.1kkk.com (customOrder 270)
// 验证日期: 2026-11-27 (curl 实测)
//   搜索: GET /search?title=海贼王&language=1 -> 200, 33KB, 标题含“海贼王”,
//     结果 /comic432/(海贼王) /manhua72057/(海贼王 艾斯) 等
//   详情: GET /comic432/ -> 200, 151KB, 标题“海贼王”, 最新第 1199 话(11月20号),
//     章节 1011 处 chapteritem; GET /manhua72057/ -> 200, 17KB, 4 章
//     章节链接两种形式: /ch{n}-{id}/ 与 /episode{id}/
//   阅读: GET /ch4-1217572/ 与 /episode1859109/ -> 200, 均含 Dean Edwards 压缩 eval,
//     解包得 newImgs (46 张 / 12 张), 与 Legado 规则的 eval 逻辑一致
//   图片: 解包出的 cdndm5.com 签名直链实测 200 image/jpeg 163KB
// 已知局限:
//   1. 图片 URL 带签名参数(cid/key/uk/hkey/t, t 为过期时间戳), 每次看章节都须先抓
//      章节页现场解包, 不能缓存图片地址; 本源已按此实现。
//   2. 部分章节带 VIP 锁图标(detail-list-lock), 站内需付费, 本源未做 VIP 标记。
//   3. 首页 explore 用首页 book-list 解析, 结构与搜索页一致(2026-11-27 首页 104KB,
//      含 book-list 28 处), 未逐项核对首页卡片字段。
class SuanNai extends ComicSource {
    name = "酸奶漫画"
    key = "suan_nai"
    version = "1.0.0"
    minAppVersion = "1.6.0"
    url = "https://cdn.jsdelivr.net/gh/3176289965f-ai/my-venera-sources@main/suan_nai.js"

    static baseUrl = "https://m.1kkk.com"
    static userAgent = "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0 Mobile Safari/537.36"

    headers(referer) {
        const h = {
            "User-Agent": SuanNai.userAgent,
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
        if (u.startsWith("/")) return SuanNai.baseUrl + u
        return u
    }

    // 章节页含 Dean Edwards 压缩 eval: eval(function(p,a,c,k,e,d){...}(...))
// 解包后是 var newImgs=[...]; 不用 eval 取变量, 而是取解包结果的完成值
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
            const arr = eval(unpacked + "\nnewImgs")
            return Array.isArray(arr) ? arr.map(u => String(u)) : []
        } catch (e) {
            return []
        }
    }

    parseBookList(doc) {
        const comics = []
        for (const li of Array.from(doc.querySelectorAll("ul.book-list li"))) {
            const a = li.querySelector("a")
            const titleEl = li.querySelector("p.book-list-info-title")
            if (!a || !titleEl) continue
            const href = a.attributes.href || ""
            const slugM = href.match(/^\/(manhua\d+|comic\d+)\/?$/)
            if (!slugM) continue
            const img = li.querySelector("img")
            const descEl = li.querySelector("p.book-list-info-desc")
            comics.push(new Comic({
                id: slugM[1],
                title: titleEl.text.trim(),
                cover: this.absoluteUrl(img ? (img.attributes.src || "") : ""),
                subTitle: descEl ? descEl.text.trim() : ""
            }))
        }
        return comics
    }

    explore = [
        {
            title: "酸奶漫画",
            type: "singlePageWithMultiPart",
            load: async () => {
                const res = await this.requestPage(SuanNai.baseUrl + "/", this.headers(SuanNai.baseUrl + "/"))
                const doc = new HtmlDocument(res.body)
                try {
                    const comics = this.parseBookList(doc)
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
                `${SuanNai.baseUrl}/search?title=${encodeURIComponent(keyword)}&language=1`,
                this.headers(SuanNai.baseUrl + "/"))
            const doc = new HtmlDocument(res.body)
            try {
                return { comics: this.parseBookList(doc), maxPage: 1 }
            } finally {
                doc.dispose()
            }
        }
    }

    comic = {
        loadInfo: async (id) => {
            const res = await this.requestPage(`${SuanNai.baseUrl}/${encodeURIComponent(id)}/`, this.headers(SuanNai.baseUrl + "/"))
            const html = res.body
            const doc = new HtmlDocument(html)
            try {
                const titleEl = doc.querySelector("p.detail-main-info-title")
                const coverEl = doc.querySelector("img.detail-main-bg")
                const introEl = doc.querySelector("p.detail-desc")
                const authorEl = doc.querySelector("p.detail-main-info-author a")
                const kindEls = Array.from(doc.querySelectorAll("p.detail-main-info-class a"))
                const tags = {}
                if (authorEl) {
                    const t = authorEl.text.trim()
                    if (t) tags["作者"] = [t]
                }
                if (kindEls.length > 0) {
                    tags["分类"] = kindEls.map(e => e.text.trim()).filter(Boolean)
                }
                // 章节: ul.detail-list-select li a.chapteritem, href 有 /ch{n}-{id}/ 与
                // /episode{id}/ 两种形式; 页面为降序(最新在前), 倒转为升序
                const eps = []
                for (const a of Array.from(doc.querySelectorAll("ul.detail-list-select li a.chapteritem"))) {
                    const href = a.attributes.href || ""
                    const slugM = href.match(/^\/(ch\d+-\d+|episode\d+)\/?$/)
                    const name = (a.text || "").trim()
                    if (slugM && name) eps.push([slugM[1], name])
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
                    cover: coverEl ? this.absoluteUrl(coverEl.attributes.src || "") : "",
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
                `${SuanNai.baseUrl}/${encodeURIComponent(epId)}/`,
                this.headers(`${SuanNai.baseUrl}/${encodeURIComponent(comicId)}/`))
            return { images: this.unpackChapterImages(res.body) }
        },
        onImageLoad: (imageKey, comicId, ep) => {
            return {
                url: imageKey,
                headers: {
                    "User-Agent": SuanNai.userAgent,
                    "Referer": `${SuanNai.baseUrl}/${encodeURIComponent(ep)}/`,
                    "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
                    "Accept-Language": "zh-CN,zh;q=0.9",
                }
            }
        },
        onThumbnailLoad: (imageKey) => {
            return {
                headers: {
                    "User-Agent": SuanNai.userAgent,
                    "Referer": SuanNai.baseUrl + "/",
                    "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
                    "Accept-Language": "zh-CN,zh;q=0.9",
                }
            }
        }
    }
}
