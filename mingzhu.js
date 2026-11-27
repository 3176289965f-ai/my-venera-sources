// 名著阅读 (api.520diandu.com) Venera 漫画源
// 版本: 1.0.0
// 基于 Legado 规则「名著阅读（优）」(api.520diandu.com) 转换，验证日期 2026-11-27
//   实际是名著连环画/绘本 API：每本书 = 若干页扫描图，每页 1 张图
//   搜索 allReadBooks 返回 books（含 id/book_name/title/famous 封面）；
//   详情 readAllPages 返回 data 数组，每项 {id, page, pic}；页码 0..251 连续（个别重复），共 255 张图
//   Venera 里每页映射为一章「第 N 页」（按条目顺序编号），打开章节即显示该页图片
//   注意：详情接口本身不返回书名/封面，搜索时把元数据编码进 id（JSON），loadInfo 再解出来
// 证据（2026-11-27，curl 实测）：
//   搜索 西游记：200，code 2000，命中 id 43632；探索（无关键词）：200，total_num 60，每页 16 条
//   详情 bid=43632：255 条，页码 0..251 连续，图片去重 255 张
//   图片 https://aidianducdn.520diandu.com//storage/uploads/read/pic_wat/202007/20200717100757_54109.jpg：200，117KB，image/jpeg
//   封面 aidianducdn.520diandu.com/.../base_book/...jpg：200，20KB（中途两次 000 为 VM 代理抖动，重试后 200）
class MingZhu extends ComicSource {
    name = "名著阅读"
    key = "mingzhu"
    version = "1.0.0"
    minAppVersion = "1.4.0"
    url = "https://cdn.jsdelivr.net/gh/3176289965f-ai/my-venera-sources@main/mingzhu.js"

    static apiBase = "https://api.520diandu.com"
    static userAgent = "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Mobile Safari/537.36"
    static pageSize = 16 // allReadBooks 每页 16 条（实测）

    headers() {
        return {
            "User-Agent": MingZhu.userAgent,
            "Accept": "application/json, */*; q=0.01",
            "Accept-Language": "zh-CN,zh;q=0.9",
            "Accept-Encoding": "gzip, deflate",
            "Connection": "keep-alive",
        }
    }

    // id 承载搜索时的元数据：JSON {bid, title, cover, desc}
    encodeId(book) {
        return JSON.stringify({
            bid: String(book.id),
            title: book.book_name || "",
            cover: book.famous || "",
            desc: book.title || ""
        })
    }

    decodeId(id) {
        try {
            return JSON.parse(id)
        } catch (e) {
            return { bid: String(id), title: "", cover: "", desc: "" }
        }
    }

    parseBook(b) {
        if (!b || b.id === undefined || b.id === null) return null
        return new Comic({
            id: this.encodeId(b),
            title: (b.book_name || "").trim(),
            cover: b.famous || "",
            subTitle: (b.title || "").trim()
        })
    }

    parseBooks(json) {
        const books = (json.data && json.data.books) || []
        const comics = []
        for (const b of books) {
            const c = this.parseBook(b)
            if (c) comics.push(c)
        }
        return comics
    }

    async fetchPages(bid) {
        const res = await Network.get(`${MingZhu.apiBase}/api/read/readAllPages?uid=&key=&cv=134&from=web&bid=${encodeURIComponent(bid)}`, this.headers())
        const json = JSON.parse(res.body)
        return Array.isArray(json.data) ? json.data : []
    }

    explore = [
        {
            title: "名著阅读",
            type: "singlePageWithMultiPart",
            load: async () => {
                const res = await Network.get(`${MingZhu.apiBase}/api/read/allReadBooks?uid=&key=&page=1&cv=134&from=web`, this.headers())
                const comics = this.parseBooks(JSON.parse(res.body))
                const result = {}
                if (comics.length > 0) result["全部书籍"] = comics
                return result
            }
        }
    ]

    search = {
        load: async (keyword, options, page) => {
            const res = await Network.get(`${MingZhu.apiBase}/api/read/allReadBooks?uid=&key=&name=${encodeURIComponent(keyword)}&page=${page}&cv=134&from=app`, this.headers())
            const json = JSON.parse(res.body)
            const total = (json.data && json.data.total_num) || 0
            return {
                comics: this.parseBooks(json),
                maxPage: Math.max(1, Math.ceil(total / MingZhu.pageSize))
            }
        }
    }

    comic = {
        loadInfo: async (id) => {
            const meta = this.decodeId(id)
            const pages = await this.fetchPages(meta.bid)
            this._pagesCache = this._pagesCache || {}
            this._pagesCache[meta.bid] = pages
            const eps = new Map()
            for (let i = 0; i < pages.length; i++) {
                eps.set(String(i), `第${i + 1}页`)
            }
            const chapters = new Map()
            if (eps.size > 0) chapters.set("全书", eps)
            return new ComicDetails({
                title: meta.title || meta.bid,
                cover: meta.cover || "",
                description: meta.desc || "",
                tags: {},
                chapters: chapters,
                subId: id
            })
        },
        loadEp: async (comicId, epId) => {
            const meta = this.decodeId(comicId)
            let pages = (this._pagesCache && this._pagesCache[meta.bid]) || null
            if (!pages) {
                pages = await this.fetchPages(meta.bid)
                this._pagesCache = this._pagesCache || {}
                this._pagesCache[meta.bid] = pages
            }
            const idx = parseInt(epId, 10)
            const item = pages[idx]
            const pic = item ? (item.pic || "") : ""
            return { images: pic ? [pic] : [] }
        },
        onImageLoad: (imageKey, comicId, ep) => {
            return {
                url: imageKey,
                headers: {
                    "User-Agent": MingZhu.userAgent,
                    "Referer": MingZhu.apiBase + "/",
                    "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
                    "Accept-Language": "zh-CN,zh;q=0.9",
                }
            }
        },
        onThumbnailLoad: (imageKey) => {
            return {
                headers: {
                    "User-Agent": MingZhu.userAgent,
                    "Referer": MingZhu.apiBase + "/",
                    "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
                    "Accept-Language": "zh-CN,zh;q=0.9",
                }
            }
        }
    }
}
