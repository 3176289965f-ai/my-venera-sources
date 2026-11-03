# my-venera-sources

Xiang 的 Venera 合并漫画源列表。

- 共 60 条，去重后版本：官方 venera-configs（33 条）+ handahao666-boop/venera_comic_source（44 条），按 key 去重，重叠 15 个，删重复 2 个（拷贝漫画多账号版、爱看漫旧版）。
- 每条只留 `url`，指向原仓库的 jsdelivr 地址，Venera 按 url 拉取 `.js` 文件。
- 登录、非大陆 IP 的源不算坏，照常保留并附注条件。
- 本仓库由 Dom 每日检查原仓库变化：原仓库删源、改名、换文件、升版本时，同步更新这里的 `index.json` 并通知 Xiang；以后有新源也可以发给 Dom 分析去重后加进来。

使用方法（Venera 来源库）：
- 名称：任意，如“我的漫画源”
- URL：https://cdn.jsdelivr.net/gh/3176289965f-ai/my-venera-sources@main/index.json
