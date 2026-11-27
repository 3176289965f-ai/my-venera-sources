// 漫客栈 (comic.mkzcdn.com / comic.mkzhan.com) Venera 漫画源
// 版本: 1.0.0
// 验证日期: 2026-11-27（curl 实测，VM 代理）
// 基于 Legado 规则转制：
//   - 主用「武芊漫画」(comic.mkzcdn.com，Legado customOrder 283)：纯 JSON API，无需登录
//   - 备用「漫客栈子」(comic.mkzhan.com，customOrder 299)：同 shape，sign=0/uid=0 可直接用
//   - 参考「漫客栈子」(www.mkzhan.com，HTML 搜索) 与「漫客栈吧」(需 member.mkzcdn.com OAuth 登录取 sign/uid，已排除，不用)
// 证据：
//   - 搜索「妖神记」: GET /search/keyword/?keyword=妖神记&page_num=1&page_size=20 -> 200，code 200，1 条（id 207622，作者 踏雪动漫，第539话2）
//     （搜「斗罗」返回 code 199 空结果，属实：斗罗不在漫客栈，不代表搜索坏）
//   - 详情: GET /comic/info/?comic_id=207622 -> 200，标题/简介齐全
//   - 目录: GET /chapter/v1/?comic_id=207622 -> 200，共 979 章（第1话 重生 ～ 第539话2）
//   - 内容: GET /chapter/content/?chapter_id=476064&comic_id=207622 -> 200，14 页，图片 http://oss.mkzcdn.com/image/...
//   - 图片: oss.mkzcdn.com 图片直链 GET 200 image/jpeg 284KB（http/https 均可，无需 Referer）
//   - mkzhan.com 对照同样全通（搜索/目录 979 章/内容 14 页），其图片带 auth_key 参数，故主用 mkzcdn
// 注意：theme_id 用 Legado 规则里的题材映射表转中文名
class Mkzhan extends ComicSource {
    name = "漫客栈"
    key = "mkzhan"
    version = "1.0.0"
    minAppVersion = "1.6.0"
    url = "https://cdn.jsdelivr.net/gh/3176289965f-ai/my-venera-sources@main/mkzhan.js"

    static apiBase = "https://comic.mkzcdn.com"
    static userAgent = "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/135.0 Mobile Safari/537.36"
    // Legado 规则里的 theme_id -> 题材名（class_url 与 class_name 一一对应）
    static themeMap = {
        "0": "全部", "2": "修真", "1": "霸总", "3": "恋爱", "4": "校园",
        "5": "冒险", "6": "搞笑", "7": "生活", "8": "热血", "9": "架空",
        "10": "后宫", "12": "玄幻", "13": "悬疑", "14": "恐怖", "15": "灵异",
        "16": "动作", "17": "科幻", "18": "战争", "19": "古风", "20": "穿越",
        "21": "竞技", "23": "励志", "24": "同人", "26": "真人",
    }

    headers() {
        return {
            "User-Agent": Mkzhan.userAgent,
            "Accept": "application/json, text/plain, */*",
            "Referer": Mkzhan.apiBase + "/",
        }
    }

    themeNames(themeId) {
        if (!themeId) return []
        return String(themeId).split(",").map((t) => Mkzhan.themeMap[t.trim()] || t.trim()).filter(Boolean)
    }

    comicFromSearchItem(it) {
        if (!it || !it.comic_id) return null
        return new Comic({
            id: String(it.comic_id),
            title: it.title || "未知标题",
            cover: it.cover || "",
            subTitle: it.author_title ? it.author_title : "",
            description: it.chapter_title ? `更新至：${it.chapter_title}` : (it.feature || ""),
        })
    }

    explore = [
        {
            title: "漫客栈",
            type: "singlePageWithMultiPart",
            load: async () => {
                const result = {}
                for (const [part, order] of [["热门人气", 1], ["更新时间", 2]]) {
                    const url = `${Mkzhan.apiBase}/search/filter/?order=${order}&page_num=1&page_size=12`
                    const res = await Network.get(url, this.headers())
                    if (res.status !== 200) continue
                    const data = JSON.parse(res.body)
                    const list = data?.data?.list || []
                    const comics = list.map((it) => this.comicFromSearchItem(it)).filter(Boolean)
                    if (comics.length > 0) result[part] = comics
                }
                return result
            },
        },
    ]

    search = {
        load: async (keyword, options, page) => {
            const url = `${Mkzhan.apiBase}/search/keyword/?keyword=${encodeURIComponent(keyword)}&page_num=${page || 1}&page_size=20`
            const res = await Network.get(url, this.headers())
            if (res.status !== 200) throw `Invalid status code: ${res.status}`
            const data = JSON.parse(res.body)
            // code "200" 有结果，"199" 为空结果
            const list = data?.data?.list || []
            return {
                comics: list.map((it) => this.comicFromSearchItem(it)).filter(Boolean),
                maxPage: 1,
            }
        },
        optionList: [],
    }

    comic = {
        loadInfo: async (id) => {
            const infoUrl = `${Mkzhan.apiBase}/comic/info/?comic_id=${encodeURIComponent(id)}`
            const res = await Network.get(infoUrl, this.headers())
            if (res.status !== 200) throw `Invalid status code: ${res.status}`
            const info = JSON.parse(res.body)?.data || {}
            const title = info.title || "未知标题"
            const cover = info.cover || ""
            const description = info.content || ""
            const tags = {}
            const themes = this.themeNames(info.theme_id)
            if (themes.length > 0) tags["题材"] = themes
            if (info.chapter_title) tags["更新"] = [info.chapter_title]

            const chapters = new Map()
            try {
                const tocUrl = `${Mkzhan.apiBase}/chapter/v1/?comic_id=${encodeURIComponent(id)}`
                const tocRes = await Network.get(tocUrl, this.headers())
                if (tocRes.status === 200) {
                    const tocData = JSON.parse(tocRes.body)?.data || []
                    const eps = new Map()
                    for (const ch of tocData) {
                        if (ch?.chapter_id && ch?.title) eps.set(String(ch.chapter_id), ch.title)
                    }
                    if (eps.size > 0) chapters.set("全部章节", eps)
                }
            } catch (e) {
                // 目录拉不到时仍返回详情
            }

            return {
                title: title,
                cover: cover,
                description: description,
                tags: tags,
                chapters: chapters,
            }
        },

        loadEp: async (comicId, epId) => {
            const url = `${Mkzhan.apiBase}/chapter/content/?chapter_id=${encodeURIComponent(epId)}&comic_id=${encodeURIComponent(comicId)}`
            const res = await Network.get(url, this.headers())
            if (res.status !== 200) throw `Invalid status code: ${res.status}`
            const data = JSON.parse(res.body)?.data || []
            const images = []
            for (const p of data) {
                if (p?.image) images.push(p.image)
            }
            return { images }
        },

        onImageLoad: (url, comicId, epId) => {
            return {
                url,
                method: "GET",
                headers: { "User-Agent": Mkzhan.userAgent },
                onLoadFailed: () => ({ url }),
            }
        },

        onThumbnailLoad: (url) => {
            return {
                url: url,
                method: "GET",
                headers: { "User-Agent": Mkzhan.userAgent },
                onLoadFailed: () => ({ url }),
            }
        },
    }
}
