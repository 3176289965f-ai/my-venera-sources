// 全免漫画 (api-cdn.kaimanhua.com) Venera 漫画源
// 版本: 1.0.0
// 基于 Legado 规则「全免漫画 / 全免漫画（优）」(两条规则除 checkKeyWord 外完全相同）转换，验证日期 2026-11-27
//   搜索 getsortlist 返回明文 JSON；详情 getcomicdata 与章节 getchapterdata 返回 AES 加密的 data 字段，
//   密文形如 "arsadata" + base64，AES-128-CBC，key 4548ded8c9e02690，iv 1992360ee9bc4f8f，
//   解密后详情是 JSON 对象、章节是 JSON 数组字符串；两个 v2 接口都要 m-request-id 签名，
//   签名 = MD5(接口 path + 不带 ? 的 query + "erciyuan2020")，章节接口另需固定的 access-token 请求头
//   Venera 内置 Convert.decryptAesCbc（minAppVersion 1.6.0，见 manwaba.js 用法）；MD5 无内置接口，本文件内嵌实现
// 证据（2026-11-27，curl + openssl 实测）：
//   搜索 海贼王：200，93 条结果（Go!海王子天团 105862 等），total_page 5
//   详情 getcomicdata（MD5 签名 c7dde91985c92a020362e7fcbde60610）：200，AES 解密成功，64 章（人设/序章/第1话…最终话）
//   章节 getchapterdata（签名 f478d77bf71580f20a4883d175c641b2 + access-token）：200，AES 解密成功，22 张图
//   图片 hw-chapter3.kaimanhua.com：200，129KB，image/webp；封面 image.yqmh.com/mh/105862.jpg-600x800.jpg.webp：200，175KB
// 待验证：access-token 是 Legado 规则里写死的固定值，今天能用，过期后章节接口可能 401，需换新 token
//   图片 URL 带 auth_key 签名（有时效，每次打开章节重新拉取）

// ---- MD5 (RFC 1321) 内嵌实现；node 验算通过：
//   md5("")=d41d8cd98f00b204e9800998ecf8427e，md5("abc")=900150983cd24fb0d6963f7d28e17f72，
//   详情签名串 -> c7dde91985c92a020362e7fcbde60610，章节签名串 -> f478d77bf71580f20a4883d175c641b2
const _md5HexChr = "0123456789abcdef".split("");
function _md5Add32(a, b) { return (a + b) & 0xFFFFFFFF; }
function _md5Cmn(q, a, b, x, s, t) {
    a = _md5Add32(_md5Add32(a, q), _md5Add32(x, t));
    return _md5Add32((a << s) | (a >>> (32 - s)), b);
}
function _md5Ff(a, b, c, d, x, s, t) { return _md5Cmn((b & c) | (~b & d), a, b, x, s, t); }
function _md5Gg(a, b, c, d, x, s, t) { return _md5Cmn((b & d) | (c & ~d), a, b, x, s, t); }
function _md5Hh(a, b, c, d, x, s, t) { return _md5Cmn(b ^ c ^ d, a, b, x, s, t); }
function _md5Ii(a, b, c, d, x, s, t) { return _md5Cmn(c ^ (b | ~d), a, b, x, s, t); }
function _md5Blk(s) {
    const blk = [];
    for (let i = 0; i < 64; i += 4) {
        blk[i >> 2] = s.charCodeAt(i) + (s.charCodeAt(i + 1) << 8) + (s.charCodeAt(i + 2) << 16) + (s.charCodeAt(i + 3) << 24);
    }
    return blk;
}
function _md5Cycle(x, k) {
    let a = x[0], b = x[1], c = x[2], d = x[3];
    a = _md5Ff(a, b, c, d, k[0], 7, -680876936); d = _md5Ff(d, a, b, c, k[1], 12, -389564586);
    c = _md5Ff(c, d, a, b, k[2], 17, 606105819); b = _md5Ff(b, c, d, a, k[3], 22, -1044525330);
    a = _md5Ff(a, b, c, d, k[4], 7, -176418897); d = _md5Ff(d, a, b, c, k[5], 12, 1200080426);
    c = _md5Ff(c, d, a, b, k[6], 17, -1473231341); b = _md5Ff(b, c, d, a, k[7], 22, -45705983);
    a = _md5Ff(a, b, c, d, k[8], 7, 1770035416); d = _md5Ff(d, a, b, c, k[9], 12, -1958414417);
    c = _md5Ff(c, d, a, b, k[10], 17, -42063); b = _md5Ff(b, c, d, a, k[11], 22, -1990404162);
    a = _md5Ff(a, b, c, d, k[12], 7, 1804603682); d = _md5Ff(d, a, b, c, k[13], 12, -40341101);
    c = _md5Ff(c, d, a, b, k[14], 17, -1502002290); b = _md5Ff(b, c, d, a, k[15], 22, 1236535329);
    a = _md5Gg(a, b, c, d, k[1], 5, -165796510); d = _md5Gg(d, a, b, c, k[6], 9, -1069501632);
    c = _md5Gg(c, d, a, b, k[11], 14, 643717713); b = _md5Gg(b, c, d, a, k[0], 20, -373897302);
    a = _md5Gg(a, b, c, d, k[5], 5, -701558691); d = _md5Gg(d, a, b, c, k[10], 9, 38016083);
    c = _md5Gg(c, d, a, b, k[15], 14, -660478335); b = _md5Gg(b, c, d, a, k[4], 20, -405537848);
    a = _md5Gg(a, b, c, d, k[9], 5, 568446438); d = _md5Gg(d, a, b, c, k[14], 9, -1019803690);
    c = _md5Gg(c, d, a, b, k[3], 14, -187363961); b = _md5Gg(b, c, d, a, k[8], 20, 1163531501);
    a = _md5Gg(a, b, c, d, k[13], 5, -1444681467); d = _md5Gg(d, a, b, c, k[2], 9, -51403784);
    c = _md5Gg(c, d, a, b, k[7], 14, 1735328473); b = _md5Gg(b, c, d, a, k[12], 20, -1926607734);
    a = _md5Hh(a, b, c, d, k[5], 4, -378558); d = _md5Hh(d, a, b, c, k[8], 11, -2022574463);
    c = _md5Hh(c, d, a, b, k[11], 16, 1839030562); b = _md5Hh(b, c, d, a, k[14], 23, -35309556);
    a = _md5Hh(a, b, c, d, k[1], 4, -1530992060); d = _md5Hh(d, a, b, c, k[4], 11, 1272893353);
    c = _md5Hh(c, d, a, b, k[7], 16, -155497632); b = _md5Hh(b, c, d, a, k[10], 23, -1094730640);
    a = _md5Hh(a, b, c, d, k[13], 4, 681279174); d = _md5Hh(d, a, b, c, k[0], 11, -358537222);
    c = _md5Hh(c, d, a, b, k[3], 16, -722521979); b = _md5Hh(b, c, d, a, k[6], 23, 76029189);
    a = _md5Hh(a, b, c, d, k[9], 4, -640364487); d = _md5Hh(d, a, b, c, k[12], 11, -421815835);
    c = _md5Hh(c, d, a, b, k[15], 16, 530742520); b = _md5Hh(b, c, d, a, k[2], 23, -995338651);
    a = _md5Ii(a, b, c, d, k[0], 6, -198630844); d = _md5Ii(d, a, b, c, k[7], 10, 1126891415);
    c = _md5Ii(c, d, a, b, k[14], 15, -1416354905); b = _md5Ii(b, c, d, a, k[5], 21, -57434055);
    a = _md5Ii(a, b, c, d, k[12], 6, 1700485571); d = _md5Ii(d, a, b, c, k[3], 10, -1894986606);
    c = _md5Ii(c, d, a, b, k[10], 15, -1051523); b = _md5Ii(b, c, d, a, k[1], 21, -2054922799);
    a = _md5Ii(a, b, c, d, k[8], 6, 1873313359); d = _md5Ii(d, a, b, c, k[15], 10, -30611744);
    c = _md5Ii(c, d, a, b, k[6], 15, -1560198380); b = _md5Ii(b, c, d, a, k[13], 21, 1309151649);
    a = _md5Ii(a, b, c, d, k[4], 6, -145523070); d = _md5Ii(d, a, b, c, k[11], 10, -1120210379);
    c = _md5Ii(c, d, a, b, k[2], 15, 718787259); b = _md5Ii(b, c, d, a, k[9], 21, -343485551);
    x[0] = _md5Add32(a, x[0]); x[1] = _md5Add32(b, x[1]); x[2] = _md5Add32(c, x[2]); x[3] = _md5Add32(d, x[3]);
}
function _md5State(s) {
    const n = s.length;
    const state = [1732584193, -271733879, -1732584194, 271733878];
    let i;
    for (i = 64; i <= s.length; i += 64) {
        _md5Cycle(state, _md5Blk(s.substring(i - 64, i)));
    }
    s = s.substring(i - 64);
    const tail = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    for (i = 0; i < s.length; i++) tail[i >> 2] |= s.charCodeAt(i) << ((i % 4) << 3);
    tail[i >> 2] |= 0x80 << ((i % 4) << 3);
    if (i > 55) {
        _md5Cycle(state, tail);
        for (i = 0; i < 16; i++) tail[i] = 0;
    }
    tail[14] = n * 8;
    _md5Cycle(state, tail);
    return state;
}
function _md5Rhex(n) {
    let s = "";
    for (let j = 0; j < 4; j++) s += _md5HexChr[(n >> (j * 8 + 4)) & 0x0F] + _md5HexChr[(n >> (j * 8)) & 0x0F];
    return s;
}
function md5Hex(input) {
    const s = unescape(encodeURIComponent(input));
    return _md5State(s).map(_md5Rhex).join("");
}

class KaiManHua extends ComicSource {
    name = "全免漫画"
    key = "kaimanhua"
    version = "1.0.0"
    minAppVersion = "1.6.0" // 需 Convert.decryptAesCbc（同 manwaba.js）
    url = "https://cdn.jsdelivr.net/gh/3176289965f-ai/my-venera-sources@main/kaimanhua.js"

    static apiBase = "https://api-cdn.kaimanhua.com"
    static clientParams = "client-type=android&productname=qmmh&client-channel=xiaomi&platformname=android&client-version=1.4.8"
    static userAgent = "okhttp/4.9.1"
    static aesKey = "4548ded8c9e02690"
    static aesIv = "1992360ee9bc4f8f"
    static signSuffix = "erciyuan2020"
    // Legado 规则里写死的 access-token（2026-11-27 实测可用）；过期后章节接口可能 401，需换新 token
    static accessToken = "v1_090fNTIt4Omg86B7LUPcqWRTkvW8JjjLYXTxnm01BiXN8SgniETjucYezOrjZoOopFGr02Fj12RREysE4eHukTCc/LuyeIHzFGMayAgLGaSF8+jMMwrnDdTuYdFk34z7DZf+Zy+VHtjFS0Uy6n6Vyr/5GuJy6FDcbCoVBCjdbFneHjV38UwHjL6AwauUMFfa0f3uSEqGWZG6xn9+OpAn6GGRWHaypicXswr450DO29FcuqP7pHCSldVJtIzOv/Uc"

    // v2 接口签名：MD5(path + 不带 ? 的 query + "erciyuan2020")
    sign(path, query) {
        return md5Hex(path + query + KaiManHua.signSuffix)
    }

    // data 字段解密："arsadata" + base64 -> AES-128-CBC -> UTF-8 字符串
    decryptDataField(dataStr) {
        let s = String(dataStr || "")
        if (s.startsWith("arsadata")) s = s.slice("arsadata".length)
        const cipher = Convert.decodeBase64(s)
        const key = Convert.encodeUtf8(KaiManHua.aesKey)
        const iv = Convert.encodeUtf8(KaiManHua.aesIv)
        const plain = Convert.decryptAesCbc(cipher, key, iv)
        return Convert.decodeUtf8(plain)
    }

    headers(extra) {
        const h = {
            "User-Agent": KaiManHua.userAgent,
            "Accept": "application/json, */*; q=0.01",
            "Accept-Encoding": "gzip, deflate",
            "Connection": "keep-alive",
        }
        if (extra) Object.assign(h, extra)
        return h
    }

    parseSearchComic(c) {
        const id = String(c.comic_id || "")
        if (!id) return null
        return new Comic({
            id: id,
            title: (c.comic_name || "").trim(),
            cover: c.cover_img || "",
            subTitle: (c.last_chapter_name || "").trim()
        })
    }

    async sortList(query) {
        const res = await Network.get(`${KaiManHua.apiBase}/comic-api/v1/comic/getsortlist?${query}`, this.headers())
        const json = JSON.parse(res.body)
        const list = (json.data && json.data.data) || []
        const comics = []
        for (const c of list) {
            const comic = this.parseSearchComic(c)
            if (comic) comics.push(comic)
        }
        return { comics: comics, maxPage: (json.data && json.data.page && json.data.page.total_page) || 1 }
    }

    explore = [
        {
            title: "全免漫画",
            type: "singlePageWithMultiPart",
            load: async () => {
                const result = {}
                const sections = [
                    ["热门收藏", `search_key=&orderby=shoucang&page=1&pagesize=12&young_mode=0&${KaiManHua.clientParams}`],
                    ["最新更新", `search_key=&orderby=date&page=1&pagesize=12&young_mode=0&${KaiManHua.clientParams}`],
                    ["热血", `status_id=0&comic_sort=rexue&human_type=0&orderby=date&pagesize=12&page=1&young_mode=0&${KaiManHua.clientParams}`],
                    ["恋爱", `status_id=0&comic_sort=lianai&human_type=0&orderby=date&pagesize=12&page=1&young_mode=0&${KaiManHua.clientParams}`],
                ]
                for (const [section, query] of sections) {
                    const r = await this.sortList(query)
                    if (r.comics.length > 0) result[section] = r.comics
                }
                return result
            }
        }
    ]

    search = {
        load: async (keyword, options, page) => {
            const query = `search_key=${encodeURIComponent(keyword)}&orderby=shoucang&page=${page}&pagesize=20&young_mode=0&${KaiManHua.clientParams}`
            return await this.sortList(query)
        }
    }

    comic = {
        loadInfo: async (id) => {
            const path = "/comic-api/v2/comic/getcomicdata"
            const query = `comic_id=${encodeURIComponent(id)}&${KaiManHua.clientParams}`
            const res = await Network.get(
                `${KaiManHua.apiBase}${path}?${query}`,
                this.headers({ "m-request-id": this.sign(path, query) })
            )
            const json = JSON.parse(res.body)
            const data = JSON.parse(this.decryptDataField(json.data))
            const tags = {}
            if (data.comic_taglist) tags["标签"] = String(data.comic_taglist).split("\n").map(s => s.trim()).filter(Boolean)
            if (data.author_name) tags["作者"] = [data.author_name]
            const eps = new Map()
            for (const c of (data.chapters || [])) {
                const chid = String(c.chapter_id || "")
                if (chid) eps.set(chid, (c.chapter_name || "").trim())
            }
            const chapters = new Map()
            if (eps.size > 0) chapters.set("章节", eps)
            return new ComicDetails({
                title: (data.comic_name || "").trim() || id,
                cover: data.cover_img_34 || data.cover_img || "",
                description: (data.comic_desc || "").trim(),
                tags: tags,
                chapters: chapters,
                subId: id
            })
        },
        loadEp: async (comicId, epId) => {
            const path = "/comic-api/v2/comic/getchapterdata"
            const query = `comic_id=${encodeURIComponent(comicId)}&chapter_id=${encodeURIComponent(epId)}&quality=middle&${KaiManHua.clientParams}`
            const res = await Network.get(
                `${KaiManHua.apiBase}${path}?${query}`,
                this.headers({
                    "m-request-id": this.sign(path, query),
                    "access-token": KaiManHua.accessToken
                })
            )
            const json = JSON.parse(res.body)
            const plain = this.decryptDataField(json.data)
            const images = JSON.parse(plain)
            return { images: Array.isArray(images) ? images : [] }
        },
        onImageLoad: (imageKey, comicId, ep) => {
            return {
                url: imageKey,
                headers: {
                    "User-Agent": KaiManHua.userAgent,
                    "Referer": KaiManHua.apiBase + "/",
                    "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
                }
            }
        },
        onThumbnailLoad: (imageKey) => {
            return {
                headers: {
                    "User-Agent": KaiManHua.userAgent,
                    "Referer": KaiManHua.apiBase + "/",
                    "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
                }
            }
        }
    }
}
