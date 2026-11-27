// SF漫画 (mm.sfacg.com) Venera 漫画源
// 版本: 1.0.1 (2026-11-27 自托管补丁: 站点由 manhua.sfacg.com 迁至 mm.sfacg.com)
// 证据基准: 2026-11-27 取证
//   旧站 manhua.sfacg.com: 首页仍 200, 但详情页 /mh/{slug}/ 全部返回"页面找不到了"(meta refresh 回首页), 源已失效
//   新站 mm.sfacg.com: 首页/最新/分类均 200; 详情路径改为 /b/{slug}/, 分类改为 /category/{tid}/
//   搜索 s.sfacg.com/?Key=&S=0&SS=0 仍可用: "武林之王" 1 结果(/mh/WLZWD), "妖神记" -> /mh/YSJ
//   分类页 ul.comic_list > a[href=/b/SLUG/] > li(img 封面 + 最新话信息) + li(#listtitle 标题)
//   首页 li > a[href=/b/SLUG/] > img + P(标题), 分区: 热门连载/本周推荐/最新更新
//   阅读 /b/{slug}/{chapId}/ + 图片接口 /ajax/Common.ashx?op=getPics&cid=&chapId= (端点存活, 假 cid 返回 500 JSON)
// 待验证(本机无法加载详情页, 站点对本机 IP 的详情请求一律返回"出错啦"错误页):
//   详情页 h1/.cover/.comic_Serial_list 选择器与 var c(cid) 是否沿用旧模板; 阅读页 /b/{slug}/{chapId}/ 形态
//   请在 Venera 里点一本漫画重试, 若章节为空请导日志反馈
class SfacgManhua extends ComicSource {
    name = "SF漫画"
    key = "sfacg_manhua"
    version = "1.0.1"
    minAppVersion = "1.6.0"
    url = "https://cdn.jsdelivr.net/gh/3176289965f-ai/my-venera-sources@main/sfacg_manhua.js"

    static baseUrl = "https://mm.sfacg.com"
    static searchBase = "https://s.sfacg.com"
    static userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"

    cidCache = {}

    headers() {
        return {
            "User-Agent": SfacgManhua.userAgent,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "zh-CN,zh;q=0.9",
        }
    }

    absoluteUrl(u) {
        if (!u) return ""
        u = String(u).trim()
        if (u.startsWith("//")) return "https:" + u
        if (u.startsWith("/")) return SfacgManhua.baseUrl + u
        if (u.startsWith("http://") && u.indexOf("sfacg.com") > 0) {
            u = "https://" + u.substring(7)
        }
        return u
    }

    comicIdFromHref(href) {
        // 搜索页给 /mh/{slug}, 新站列表给 /b/{slug}, 两种都认
        const m = String(href || "").match(/\/(?:mh|b)\/([A-Za-z0-9_]+)/)
        return m ? m[1] : ""
    }

    // 首页卡片: li > a[href=/b/SLUG/] > img(封面) + P(标题)
    parseHomeCard(li) {
        if (!li) return null
        const a = li.querySelector("a")
        if (!a) return null
        const id = this.comicIdFromHref(a.attributes.href)
        if (!id) return null
        const img = li.querySelector("img")
        const p = li.querySelector("p")
        const title = p ? p.text.trim() : ""
        if (!title) return null
        return new Comic({
            id: id,
            title: title,
            cover: this.absoluteUrl(img ? (img.attributes.src || "") : ""),
            subTitle: ""
        })
    }

    // 分类页卡片: ul.comic_list > a[href=/b/SLUG/] > li(img 封面 + 最新话信息) + li(#listtitle 标题)
    parseCategoryItem(ul) {
        if (!ul) return null
        const a = ul.querySelector("a")
        if (!a) return null
        const id = this.comicIdFromHref(a.attributes.href)
        if (!id) return null
        const img = ul.querySelector("img")
        const titleEl = ul.querySelector("#listtitle")
        const firstLi = ul.querySelector("li")
        const sub = firstLi ? firstLi.text.replace(/\s+/g, " ").trim() : ""
        return new Comic({
            id: id,
            title: titleEl ? titleEl.text.trim() : id,
            cover: this.absoluteUrl(img ? (img.attributes.src || "") : ""),
            subTitle: sub.slice(0, 80)
        })
    }

    // 搜索页卡片(旧站 s.sfacg.com 模板未变): ul > li.Conjunction(封面+链接) + 下一li(strong a 标题 + 简介)
    parsePairList(ul) {
        if (!ul) return null
        const coverLi = ul.querySelector("li.Conjunction")
        const link = coverLi ? coverLi.querySelector("a") : null
        const img = coverLi ? coverLi.querySelector("img") : null
        const titleEl = ul.querySelector("strong a")
        if (!titleEl) return null
        // 搜索页封面 li 无链接, 用标题链接兜底取 ID
        const id = this.comicIdFromHref(link ? link.attributes.href : "") || this.comicIdFromHref(titleEl.attributes.href)
        if (!id) return null
        const descLi = ul.querySelector("li:nth-child(2)")
        let desc = ""
        if (descLi) {
            const strong = descLi.querySelector("strong")
            const text = descLi.text.replace(/\s+/g, " ").trim()
            if (strong) {
                desc = text.replace(strong.text.trim(), "").trim()
            }
        }
        return new Comic({
            id: id,
            title: titleEl.text.trim(),
            cover: this.absoluteUrl(img ? (img.attributes.src || "") : ""),
            subTitle: desc.slice(0, 80)
        })
    }

    parseMaxPage(html) {
        let max = 1
        const re = /PageIndex=(\d+)/g
        let m
        while ((m = re.exec(html)) !== null) {
            const n = parseInt(m[1])
            if (n > max) max = n
        }
        return max
    }

    explore = [
        {
            title: "SF漫画",
            type: "singlePageWithMultiPart",
            load: async () => {
                const res = await Network.get(SfacgManhua.baseUrl + "/", this.headers())
                if (res.status !== 200) {
                    throw `Invalid status code: ${res.status}`
                }
                const doc = new HtmlDocument(res.body)
                try {
                    const seen = new Map()
                    for (const li of Array.from(doc.querySelectorAll("li"))) {
                        const c = this.parseHomeCard(li)
                        if (c && !seen.has(c.id)) seen.set(c.id, c)
                    }
                    return { "SF漫画": Array.from(seen.values()) }
                } finally {
                    doc.dispose()
                }
            }
        }
    ]

    category = {
        title: "SF漫画",
        parts: [
            {
                name: "题材",
                type: "fixed",
                categories: ["热血", "校园", "推理", "机战", "冒险", "运动", "耽美", "搞笑", "科幻", "魔幻", "恐怖", "社会", "爱情", "武侠", "温情"],
                categoryParams: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15"],
                itemType: "category"
            }
        ]
    }

    categoryComics = {
        load: async (category, param, options, page) => {
            const url = `${SfacgManhua.baseUrl}/category/${param}/`
            const res = await Network.get(url, this.headers())
            if (res.status !== 200) {
                throw `Invalid status code: ${res.status}`
            }
            const doc = new HtmlDocument(res.body)
            try {
                const comics = []
                for (const ul of Array.from(doc.querySelectorAll("ul.comic_list"))) {
                    const c = this.parseCategoryItem(ul)
                    if (c) comics.push(c)
                }
                return {
                    comics: comics,
                    maxPage: this.parseMaxPage(res.body)
                }
            } finally {
                doc.dispose()
            }
        }
    }

    search = {
        load: async (keyword, options, page) => {
            const kw = encodeURIComponent(keyword)
            const url = page > 1
                ? `${SfacgManhua.searchBase}/default.aspx?Key=${kw}&S=0&SS=0&PageIndex=${page}`
                : `${SfacgManhua.searchBase}/?Key=${kw}&S=0&SS=0`
            const res = await Network.get(url, this.headers())
            if (res.status !== 200) {
                throw `Invalid status code: ${res.status}`
            }
            const doc = new HtmlDocument(res.body)
            try {
                const comics = []
                // 搜索结果: 表格内多个 ul, 每个 ul = li.Conjunction(封面) + li(标题/简介)
                for (const ul of Array.from(doc.querySelectorAll("ul"))) {
                    if (ul.querySelector("li.Conjunction") && ul.querySelector("strong a")) {
                        const c = this.parsePairList(ul)
                        if (c) comics.push(c)
                    }
                }
                return {
                    comics: comics,
                    maxPage: this.parseMaxPage(res.body)
                }
            } finally {
                doc.dispose()
            }
        }
    }

    comic = {
        loadInfo: async (id) => {
            const res = await Network.get(`${SfacgManhua.baseUrl}/b/${encodeURIComponent(id)}/`, this.headers())
            if (res.status !== 200) {
                throw `Invalid status code: ${res.status}`
            }
            const html = res.body
            // 缓存数字 comic id (阅读页图片接口需要)
            const cidM = html.match(/var c = (\d+)/)
            if (cidM) {
                this.cidCache[id] = cidM[1]
            }
            const doc = new HtmlDocument(html)
            try {
                const titleEl = doc.querySelector("h1")
                const coverEl = doc.querySelector(".cover img")
                const introM = html.match(/<\/span><br\s*\/?>\s*([\s\S]*?)<span class="broken_line"/)
                const authorM = html.match(/作者：<\/span><a[^>]*>([^<]+)<\/a>/)
                const genreM = html.match(/作品类型：<\/span><a[^>]*>([^<]+)<\/a>/)
                const statusM = html.match(/\[(连载中|完结)\]/)

                const description = introM ? introM[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim() : ""
                const tags = {}
                if (authorM && authorM[1].trim()) tags["作者"] = [authorM[1].trim()]
                if (genreM && genreM[1].trim()) tags["题材"] = [genreM[1].trim()]
                if (statusM && statusM[1]) tags["状态"] = [statusM[1] === "连载中" ? "连载中" : "已完结"]

                const eps = new Map()
                for (const a of Array.from(doc.querySelectorAll(".comic_Serial_list a"))) {
                    const m = String(a.attributes.href || "").match(/\/(\d+)\/$/)
                    const t = a.text.trim()
                    if (m) {
                        eps.set(m[1], t)
                    }
                }
                const chapters = new Map()
                if (eps.size > 0) {
                    chapters.set("正篇", eps)
                }

                return new ComicDetails({
                    title: titleEl ? titleEl.text.trim() : id,
                    cover: coverEl ? this.absoluteUrl(coverEl.attributes.src || "") : "",
                    description: description,
                    tags: tags,
                    chapters: chapters,
                    subId: this.cidCache[id] || id
                })
            } finally {
                doc.dispose()
            }
        },
        loadEp: async (comicId, epId) => {
            let cid = this.cidCache[comicId]
            if (!cid) {
                // 从历史直接进入时无缓存: 抓阅读页取 cid
                const v = await Network.get(`${SfacgManhua.baseUrl}/b/${encodeURIComponent(comicId)}/${encodeURIComponent(epId)}/`, this.headers())
                const m = v.body.match(/var c = (\d+)/)
                cid = m ? m[1] : ""
                this.cidCache[comicId] = cid
            }
            if (!cid) {
                throw "无法获取漫画ID(cid)"
            }
            const url = `${SfacgManhua.baseUrl}/ajax/Common.ashx?op=getPics&cid=${cid}&chapId=${encodeURIComponent(epId)}`
            const res = await Network.get(url, {
                ...this.headers(),
                "Referer": `${SfacgManhua.baseUrl}/b/${encodeURIComponent(comicId)}/${encodeURIComponent(epId)}/`,
                "X-Requested-With": "XMLHttpRequest",
            })
            if (res.status !== 200) {
                throw `Invalid status code: ${res.status}`
            }
            const data = JSON.parse(res.body)
            if (!data || data.status !== 200 || !Array.isArray(data.data)) {
                return { images: [] }
            }
            return {
                images: data.data.map(u => this.absoluteUrl(u)).filter(u => u)
            }
        }
    }
}
