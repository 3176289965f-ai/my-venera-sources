// 好看漫画 (www.9comic.cn) Venera 漫画源
// 版本: 1.0.0
// 基于 Legado 规则转制: Legado 源名“好看漫画”, bookSourceUrl https://www.9comic.cn/ (customOrder 272)
// ⚠️ 未验证 —— 2026-11-27 curl 实测: 首页、搜索 API、详情 URL 全部返回 Cloudflare
//    “Just a moment...”人机验证页(HTTP 403, 桌面/手机 UA、带 Referer 均试过),
//    http 返回空响应, api.9comic.cn 子域连不上。VM 侧无法验证任何接口。
//    本文件是按 Legado JSON 规则忠实转写的结构(搜索/详情/目录/图片全是 JSON 接口,
//    无 HTML 解析), 逻辑与 Legado 源一致, 但必须在真机上实测通过才能用;
//    若真机同样过不了 Cloudflare, 此源作废。
// Legado 规则要点(转写依据):
//   搜索: GET /comic22/so/comic?keyword={key}&p=&ver=2.0 -> JSON, 列表 $..list[*]||$.data[*],
//     字段 id/title/pic/author/info/tag/lastchapter
//   详情: GET /comic22/book/show?id={id}&imei=aanid10d10df686793008 -> JSON $.data
//   目录: GET /comic22/book/listChapter?imei=aanid10d10df686793008&id={id}&p=1&n=10000
//     -> JSON $.data[*], 字段 id/name/createtime; 章节地址
//     /comic22/book/showChapter?id={chId}&imei=aanid10d10df686793008
//   图片: 章节 JSON $.data..url 数组, 请求须带 Referer: baseUrl
//   imei 为 Legado 源里写死的常量 aanid10d10df686793008, 照原样沿用。
class Haokan extends ComicSource {
    name = "好看漫画"
    key = "haokan"
    version = "1.0.0"
    minAppVersion = "1.6.0"
    url = "https://cdn.jsdelivr.net/gh/3176289965f-ai/my-venera-sources@main/haokan.js"

    static baseUrl = "https://www.9comic.cn"
    static imei = "aanid10d10df686793008"
    static userAgent = "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0 Mobile Safari/537.36"

    headers(referer) {
        const h = {
            "User-Agent": Haokan.userAgent,
            "Accept": "application/json, text/plain, */*",
            "Accept-Language": "zh-CN,zh;q=0.9",
            "Accept-Encoding": "gzip, deflate",
            "Connection": "keep-alive",
        }
        if (referer) h["Referer"] = referer
        return h
    }

    async requestJson(url, retries = 3) {
        let lastStatus = 0
        for (let i = 0; i < retries; i++) {
            try {
                const res = await Network.get(url, this.headers(Haokan.baseUrl + "/"))
                lastStatus = res.status
                if (res.status === 403 || res.status >= 500) {
                    await new Promise((r) => setTimeout(r, 2000 * (i + 1)))
                    continue
                }
                return JSON.parse(res.body)
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
        if (u.startsWith("/")) return Haokan.baseUrl + u
        return u
    }

    parseSearchJson(json) {
        // 列表可能在 $.data 或 $.list 下, 兼容两种
        let list = []
        if (Array.isArray(json)) {
            list = json
        } else if (json) {
            if (Array.isArray(json.data)) list = json.data
            else if (Array.isArray(json.list)) list = json.list
            else if (json.data && Array.isArray(json.data.list)) list = json.data.list
        }
        const comics = []
        for (const b of list) {
            if (!b || b.id === undefined) continue
            comics.push(new Comic({
                id: String(b.id),
                title: b.title || String(b.id),
                cover: this.absoluteUrl(b.pic || ""),
                subTitle: b.lastchapter || ""
            }))
        }
        return comics
    }

    explore = [
        {
            title: "好看漫画",
            type: "singlePageWithMultiPart",
            load: async () => {
                // 分类浏览: /comic22/book/list?cateid=1(都市)&p=1&n=21, 与 Legado exploreUrl 一致
                const json = await this.requestJson(
                    `${Haokan.baseUrl}/comic22/book/list?cateid=1&end=0&free=0&sort=0&p=1&n=21`)
                const comics = this.parseSearchJson(json)
                return comics.length > 0 ? { "都市": comics } : {}
            }
        }
    ]

    category = {
        title: "好看漫画",
        parts: [
            {
                name: "分类",
                type: "fixed",
                categories: ["都市", "恋爱", "爆笑", "热血", "悬疑", "古风", "校园", "搞笑", "玄幻", "励志", "恐怖", "冒险", "儿童"],
                categoryParams: ["1", "2", "3", "4", "5", "6", "7", "9", "10", "11", "13", "14", "15"],
                itemType: "category"
            }
        ]
    }

    categoryComics = {
        load: async (category, param, options, page) => {
            const json = await this.requestJson(
                `${Haokan.baseUrl}/comic22/book/list?cateid=${param}&end=0&free=0&sort=0&p=${page}&n=21`)
            return { comics: this.parseSearchJson(json), maxPage: 1 }
        }
    }

    search = {
        load: async (keyword, options, page) => {
            const json = await this.requestJson(
                `${Haokan.baseUrl}/comic22/so/comic?keyword=${encodeURIComponent(keyword)}&p=${page}&ver=2.0`)
            return { comics: this.parseSearchJson(json), maxPage: 1 }
        }
    }

    comic = {
        loadInfo: async (id) => {
            const json = await this.requestJson(
                `${Haokan.baseUrl}/comic22/book/show?id=${encodeURIComponent(id)}&imei=${Haokan.imei}`)
            const data = (json && json.data) || {}
            const tags = {}
            if (data.author) tags["作者"] = [String(data.author)]
            if (data.tag) tags["分类"] = String(data.tag).split(/[,、\s]+/).filter(Boolean)
            const tocJson = await this.requestJson(
                `${Haokan.baseUrl}/comic22/book/listChapter?imei=${Haokan.imei}&id=${encodeURIComponent(id)}&p=1&n=10000`)
            const list = (tocJson && Array.isArray(tocJson.data)) ? tocJson.data : []
            const chapters = new Map()
            if (list.length > 0) {
                const epMap = new Map()
                for (const ch of list) {
                    if (ch.id !== undefined && ch.name) epMap.set(String(ch.id), String(ch.name))
                }
                chapters.set("章节", epMap)
            }
            return new ComicDetails({
                title: data.title || id,
                cover: this.absoluteUrl(data.pic || ""),
                description: data.info || "",
                tags: tags,
                chapters: chapters,
                subId: id
            })
        },
        loadEp: async (comicId, epId) => {
            const json = await this.requestJson(
                `${Haokan.baseUrl}/comic22/book/showChapter?id=${encodeURIComponent(epId)}&imei=${Haokan.imei}`)
            // 图片地址在 $.data..url (深层 url 字段)
            const images = []
            const collect = (node) => {
                if (!node) return
                if (Array.isArray(node)) {
                    for (const it of node) collect(it)
                } else if (typeof node === "object") {
                    if (typeof node.url === "string" && node.url) images.push(node.url)
                    for (const k of Object.keys(node)) collect(node[k])
                }
            }
            collect(json && json.data)
            return { images: images }
        },
        onImageLoad: (imageKey, comicId, ep) => {
            return {
                url: imageKey,
                headers: {
                    "User-Agent": Haokan.userAgent,
                    "Referer": Haokan.baseUrl + "/",
                    "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
                    "Accept-Language": "zh-CN,zh;q=0.9",
                }
            }
        },
        onThumbnailLoad: (imageKey) => {
            return {
                headers: {
                    "User-Agent": Haokan.userAgent,
                    "Referer": Haokan.baseUrl + "/",
                    "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
                    "Accept-Language": "zh-CN,zh;q=0.9",
                }
            }
        }
    }
}
