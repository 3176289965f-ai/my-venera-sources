// xmanhua（www.xmanhua.com：酝酿/铅笔/星际漫画，同站）Venera 漫画源
// 版本: 1.0.0
// 验证日期: 2026-11-27（curl 实测，VM 代理）
// 基于 Legado 规则转制：3 条规则完全相同（酝酿漫画 customOrder 305、铅笔漫画、星际漫画），合为 1 个源
// 证据：
//   - 搜索「海贼王」: GET /search?title=海贼王&page=1（Cookie: xmanhua_lang=2）-> 200，
//     含 海贼王/海賊王yellow/海贼王盛宴/海贼王 艾斯，详情链接 /139xm/，封面 cover.xmanhua.com
//     （首次 https 000 为 VM 代理抖动，重试即通；http://www.xmanhua.com/ 301 到 https）
//   - 详情: GET /139xm/ -> 200，标题 海贼王，目录 .detail-list 共 995 处，第1151话在列
//   - 章节页: GET /m418076/（第1151话）-> 200，内含 Dean Edwards packer 打包的 eval 脚本，
//     node 解包得 newImgs 13 张：https://image.xmanhua.com/1/139/418076/1_1743.jpg?cid=418076&key=...&type=1
//   - 图片: 带 Referer 章节页 GET 200 image/jpeg 306KB；不带 Referer 403——图片必须带 Referer
// 注意：
//   - 全站请求须带 Cookie: xmanhua_lang=2（Legado 规则同款）
//   - 章节图片不用 eval：Venera 源里无 eval 先例，这里用纯 JS 实现 packer 解包（unpackPacked）
//   - 搜索页未见分页控件，maxPage 暂定 1；目录站内为倒序（最新在前），这里翻转为正序
class Xmanhua extends ComicSource {
    name = "xmanhua"
    key = "xmanhua"
    version = "1.0.0"
    minAppVersion = "1.6.0"
    url = "https://cdn.jsdelivr.net/gh/3176289965f-ai/my-venera-sources@main/xmanhua.js"

    static baseUrl = "https://www.xmanhua.com"
    static userAgent = "Mozilla/5.0 (Linux; Android 9; MIX 2 Build/PKQ1.190118.001; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/80.0.3987.99 Mobile Safari/537.36"

    headers(referer) {
        const h = {
            "User-Agent": Xmanhua.userAgent,
            "Cookie": "xmanhua_lang=2",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "zh-CN,zh;q=0.9",
        }
        if (referer) h["Referer"] = referer
        return h
    }

    absoluteUrl(u) {
        if (!u) return ""
        u = String(u).trim()
        if (u.startsWith("//")) return "https:" + u
        if (u.startsWith("/")) return Xmanhua.baseUrl + u
        return u
    }

    // 从 /139xm/ 这类 href 取 id（去斜杠）
    comicIdFromHref(href) {
        const m = String(href || "").match(/^\/(\d+xm)\//)
        return m ? m[1] : ""
    }

    // 从 /m418076/ 这类 href 取章节 id
    epIdFromHref(href) {
        const m = String(href || "").match(/^\/(m\d+)\//)
        return m ? m[1] : ""
    }

    parseMangaItem(a) {
        if (!a) return null
        const href = a.attributes?.href || ""
        const id = this.comicIdFromHref(href)
        if (!id) return null
        const titleEl = a.querySelector(".manga-item-title")
        const img = a.querySelector("img")
        const subs = Array.from(a.querySelectorAll(".manga-item-subtitle"))
        const author = subs.length > 0 ? subs[0].text.replace("作者：", "").trim() : ""
        return new Comic({
            id: id,
            title: titleEl ? titleEl.text.trim() : (a.attributes?.title || "未知标题"),
            cover: this.absoluteUrl(img ? (img.attributes?.src || "") : ""),
            subTitle: author,
        })
    }

    // JS 单引号字符串字面量反转义（packer 参数是 JS 字符串）
    unescapeJsString(s) {
        return s.replace(/\\(x[0-9a-fA-F]{2}|u[0-9a-fA-F]{4}|.)/g, (m, esc) => {
            if (esc[0] === "x") return String.fromCharCode(parseInt(esc.slice(1), 16))
            if (esc[0] === "u") return String.fromCharCode(parseInt(esc.slice(1), 16))
            const map = { n: "\n", r: "\r", t: "\t", b: "\b", f: "\f", v: "\v", "0": "\0" }
            return map[esc] !== undefined ? map[esc] : esc
        })
    }

    // Dean Edwards packer 解包（不依赖 eval）：输入 eval(function(p,a,c,k,e,d){...}(...)) 整个调用，返回解包后的源码
    unpackPacked(code) {
        const argRe = /'((?:\\.|[^'\\])*?)',\s*(\d+),\s*(\d+),\s*'((?:\\.|[^'\\])*?)'\.split\('\|'\)/
        const m = code.match(argRe)
        if (!m) throw "Packed args not found"
        const p = this.unescapeJsString(m[1])
        const a = parseInt(m[2], 10)
        const c = parseInt(m[3], 10)
        const k = this.unescapeJsString(m[4]).split("|")
        // 与 packer 的 e() 相同：数字 -> 36 进制风格 token
        const e = (num) => {
            return (num < a ? "" : e(parseInt(num / a))) + ((num = num % a) > 35 ? String.fromCharCode(num + 29) : num.toString(36))
        }
        const d = {}
        let count = c
        while (count--) d[e(count)] = k[count] || e(count)
        // packer 原逻辑是单次全局替换 /\b\w+\b/g（查表一次），不能逐 token 循环替换——
        // 替换进去的值（如 4_5173）含数字 token，循环替换会二次改写、 corrupting 结果
        return p.replace(/\b\w+\b/g, (w) => (w in d ? d[w] : w))
    }

    explore = [
        {
            title: "xmanhua",
            type: "singlePageWithMultiPart",
            load: async () => {
                const res = await Network.get(Xmanhua.baseUrl + "/", this.headers(Xmanhua.baseUrl + "/"))
                if (res.status !== 200) throw `Invalid status code: ${res.status}`
                const doc = new HtmlDocument(res.body)
                try {
                    const comics = []
                    const seen = new Set()
                    for (const a of Array.from(doc.querySelectorAll(".manga-1-list-item a, .manga-i-list-item a"))) {
                        const href = a.attributes?.href || ""
                        if (seen.has(href)) continue
                        seen.add(href)
                        const titleEl = a.parentElement?.querySelector(".manga-1-list-title, .manga-i-list-title")
                        const img = a.querySelector("img")
                        const id = this.comicIdFromHref(href)
                        if (!id) continue
                        comics.push(new Comic({
                            id: id,
                            title: titleEl ? titleEl.text.trim() : (a.attributes?.title || "未知标题"),
                            cover: this.absoluteUrl(img ? (img.attributes?.src || "") : ""),
                        }))
                    }
                    return comics.length > 0 ? { "首页推荐": comics } : {}
                } finally {
                    doc.dispose()
                }
            },
        },
    ]

    search = {
        load: async (keyword, options, page) => {
            const url = `${Xmanhua.baseUrl}/search?title=${encodeURIComponent(keyword)}&page=${page || 1}`
            const res = await Network.get(url, this.headers(Xmanhua.baseUrl + "/"))
            if (res.status !== 200) throw `Invalid status code: ${res.status}`
            const doc = new HtmlDocument(res.body)
            try {
                const comics = []
                for (const a of Array.from(doc.querySelectorAll(".manga-list>a"))) {
                    const c = this.parseMangaItem(a)
                    if (c) comics.push(c)
                }
                return { comics, maxPage: 1 }
            } finally {
                doc.dispose()
            }
        },
        optionList: [],
    }

    comic = {
        loadInfo: async (id) => {
            const url = `${Xmanhua.baseUrl}/${id}/`
            const res = await Network.get(url, this.headers(Xmanhua.baseUrl + "/"))
            if (res.status !== 200) throw `Invalid status code: ${res.status}`
            const doc = new HtmlDocument(res.body)
            try {
                const titleEl = doc.querySelector(".detail-main-top-info-title")
                const coverEl = doc.querySelector(".detail-main-top-cover-img")
                const introEl = doc.querySelector("#long")
                const authorEl = doc.querySelector(".detail-main-top-info-author-item")
                const kindEls = Array.from(doc.querySelectorAll(".detail-main-top-info-class-item"))
                const title = titleEl ? titleEl.text.trim() : "未知标题"
                const cover = this.absoluteUrl(coverEl ? (coverEl.attributes?.src || "") : "")
                const description = introEl ? introEl.text.trim() : ""
                const tags = {}
                if (authorEl && authorEl.text.trim()) tags["作者"] = [authorEl.text.trim()]
                const kinds = kindEls.map((el) => el.text.trim()).filter(Boolean)
                if (kinds.length > 0) tags["题材"] = kinds

                const chapters = new Map()
                const eps = new Map()
                const links = Array.from(doc.querySelectorAll(".detail-list a"))
                // 站内倒序（最新在前），翻转为正序
                links.reverse()
                for (const a of links) {
                    const epId = this.epIdFromHref(a.attributes?.href || "")
                    const name = (a.text || "").trim()
                    if (epId && name) eps.set(epId, name)
                }
                if (eps.size > 0) {
                    chapters.set("全部章节", eps)
                    const first = Array.from(eps.values())[eps.size - 1]
                    if (first) tags["更新"] = [first]
                }

                return {
                    title: title,
                    cover: cover,
                    description: description,
                    tags: tags,
                    chapters: chapters,
                }
            } finally {
                doc.dispose()
            }
        },

        loadEp: async (comicId, epId) => {
            const pageUrl = `${Xmanhua.baseUrl}/${epId}/`
            const res = await Network.get(pageUrl, this.headers(Xmanhua.baseUrl + "/"))
            if (res.status !== 200) throw `Invalid status code: ${res.status}`
            const m = res.body.match(/<script[^>]*>eval\(function\(p,a,c,k,e,d\)[\s\S]*?<\/script>/)
            if (!m) throw "Packed image script not found"
            const unpacked = this.unpackPacked(m[0])
            const arrM = unpacked.match(/var newImgs=\[([\s\S]*?)\];/)
            if (!arrM) throw "newImgs not found after unpack"
            const images = arrM[1].split(",").map((s) => s.trim().replace(/^['"]|['"]$/g, "")).filter((u) => u.startsWith("http"))
            if (images.length === 0) throw "Empty image list"
            return { images }
        },

        onImageLoad: (url, comicId, epId) => {
            return {
                url,
                method: "GET",
                headers: {
                    "User-Agent": Xmanhua.userAgent,
                    "Referer": `${Xmanhua.baseUrl}/${epId}/`,
                    "Cookie": "xmanhua_lang=2",
                },
                onLoadFailed: () => ({ url }),
            }
        },

        onThumbnailLoad: (url) => {
            return {
                url: url,
                method: "GET",
                headers: {
                    "User-Agent": Xmanhua.userAgent,
                    "Referer": Xmanhua.baseUrl + "/",
                },
                onLoadFailed: () => ({ url }),
            }
        },
    }
}
