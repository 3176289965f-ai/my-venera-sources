# my-venera-sources

Xiang 的 Venera 合并漫画源列表。

- 共 27 条（2026-11-27 精简后，原 60 条删 33 条，见下）；最初去重后版本：官方 venera-configs（33 条）+ handahao666-boop/venera_comic_source（44 条），按 key 去重，重叠 15 个，删重复 2 个（拷贝漫画多账号版、爱看漫旧版）。
- 每条只留 `url`，指向原仓库的 jsdelivr 地址，Venera 按 url 拉取 `.js` 文件。
- 登录、非大陆 IP 的源不算坏，照常保留并附注条件。
- 本仓库由 Dom 每日检查原仓库变化：原仓库删源、改名、换文件、升版本时，同步更新这里的 `index.json` 并通知 Xiang；以后有新源也可以发给 Dom 分析去重后加进来。

使用方法（Venera 来源库）：
- 名称：任意，如“我的漫画源”
- URL：https://cdn.jsdelivr.net/gh/3176289965f-ai/my-venera-sources@main/index.json

## 2026-11-27 精简（60 → 27 条）

Xiang 定：转不成 Legado 的 24 条 + 存疑的 8 条全删；源过时的 3 条能正常更新就做成最新保留。
- 删 33 条：拷贝漫画、腾讯动漫（正版）、嗶哩漫畫、漫画柜、GoDa漫画、飞翔漫画、古风漫画、嬉皮漫畫、MangaDex、Mangabz、Rawkuma、NoyManga、Picacg、ehentai、hitomi.la、漫蛙吧、51漫画、MOJOIN、如漫画、CxC、栗子漫画、卡多コミ、CCC追漫台、百合会（24 条）+ 嗨皮漫画、MYCOMIC、爱看漫、来漫画（分流）、香蕉漫画、漫网、优酷漫画、18漫画（8 条）+ 漫画1234（站已死，整个 amh1234.com 域名被停放：b 域名是售卖页、ww17 是广告停放页，按“能正常更新才保留”的规矩一并删了）。
- SF漫画 1.0.1：站点由 manhua.sfacg.com 迁至 mm.sfacg.com，详情路径 /mh/ → /b/，分类改为 /category/{tid}/，首页/分类解析按新站模板重写；搜索仍走 s.sfacg.com（已验证能用）。详情页本机无法加载验证（站点对本机 IP 的详情请求一律返回“出错啦”），需在 Venera 里重试。
- zero搬运网：搜索未改——/pc/pc/?keyword= 桌面 UA 下实测能用（“海贼王”3 条真结果、“妖神记”0 条，不同关键词返回不同）；/Android/Android/ 不是搜索接口（keyword 参数被忽略、搜什么都返回同一批），改过去会弄坏搜索，故保持 1.2.0 不动。
- 栗子漫画 lizimh.js 已从仓库删除（见下）。

## 打补丁的源（2026-11-03）

- 动漫屋 dm5 7.0.4：请求头加 `Accept-Encoding: identity`，修 Venera 搜索报 error decoding response body；其余与上游 7.0.3 相同，文件自托管在本仓库。
- SF漫画 sfacg_manhua 1.0.1（2026-11-27）：站点由 manhua.sfacg.com 迁至 mm.sfacg.com，详情路径 /mh/ → /b/，分类改为 /category/{tid}/，首页/分类解析按新站模板重写；搜索仍走 s.sfacg.com；文件自托管在本仓库。
- 栗子漫画 lizimh 1.2.8：已于 2026-11-27 从本仓库删除（精简决定），以下为历史记录——1.2.5：API 域名由 http 改为 https；探图失败时自动尝试全部图片线路（原代码只在第一条线路上失败就报错）；其余与上游 1.2.3 相同，文件自托管在本仓库。
- 栗子漫画 lizimh 1.2.7（2026-11-06）：上游重写版 1.2.4（API 走 mh.lizimh.net）基础上，把 1.2.5 的探图失败自动换线补丁重新打回去了——1.2.6 漏了这一步，探图只在兼容线路上失败就报错，其他线一次都没试过。
- 栗子漫画 lizimh 1.2.8（2026-11-06）：修 534 话起看不了的真正原因——从 534 话起封面带 `$jp$` 标记，按服务端下发的线路代码应走 `t1.imge.store`（`$jp$cf` 走 `pic.lizimh.net`），但旧代码把标记去掉后去兼容线路 `media.imgo.buzz` 上找，那上面根本没有这些文件（实测 535 话第 1 页在 t1 上是 200、在兼容线上是 404）。1.2.8 让探图和封面都按标记走对应的图床。
- 这两个源不再跟随上游 index 的 url，上游出新版时需重新打补丁再更新（每日同步已排除这两条的 url 覆盖）。
