# my-venera-sources

Xiang 的 Venera 合并漫画源列表。

- 共 60 条，去重后版本：官方 venera-configs（33 条）+ handahao666-boop/venera_comic_source（44 条），按 key 去重，重叠 15 个，删重复 2 个（拷贝漫画多账号版、爱看漫旧版）。
- 每条只留 `url`，指向原仓库的 jsdelivr 地址，Venera 按 url 拉取 `.js` 文件。
- 登录、非大陆 IP 的源不算坏，照常保留并附注条件。
- 本仓库由 Dom 每日检查原仓库变化：原仓库删源、改名、换文件、升版本时，同步更新这里的 `index.json` 并通知 Xiang；以后有新源也可以发给 Dom 分析去重后加进来。

使用方法（Venera 来源库）：
- 名称：任意，如“我的漫画源”
- URL：https://cdn.jsdelivr.net/gh/3176289965f-ai/my-venera-sources@main/index.json

## 打补丁的源（2026-11-03）

- 动漫屋 dm5 7.0.4：请求头加 `Accept-Encoding: identity`，修 Venera 搜索报 error decoding response body；其余与上游 7.0.3 相同，文件自托管在本仓库。
- 栗子漫画 lizimh 1.2.5：API 域名由 http 改为 https；探图失败时自动尝试全部图片线路（原代码只在第一条线路上失败就报错）；其余与上游 1.2.3 相同，文件自托管在本仓库。
- 栗子漫画 lizimh 1.2.7（2026-11-06）：上游重写版 1.2.4（API 走 mh.lizimh.net）基础上，把 1.2.5 的探图失败自动换线补丁重新打回去了——1.2.6 漏了这一步，探图只在兼容线路上失败就报错，其他线一次都没试过。
- 栗子漫画 lizimh 1.2.8（2026-11-06）：修 534 话起看不了的真正原因——从 534 话起封面带 `$jp$` 标记，按服务端下发的线路代码应走 `t1.imge.store`（`$jp$cf` 走 `pic.lizimh.net`），但旧代码把标记去掉后去兼容线路 `media.imgo.buzz` 上找，那上面根本没有这些文件（实测 535 话第 1 页在 t1 上是 200、在兼容线上是 404）。1.2.8 让探图和封面都按标记走对应的图床。
- 这两个源不再跟随上游 index 的 url，上游出新版时需重新打补丁再更新（每日同步已排除这两条的 url 覆盖）。
