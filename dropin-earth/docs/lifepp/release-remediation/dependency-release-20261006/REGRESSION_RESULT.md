# 两项依赖安全回归测试

2026-10-06 07:22 UTC，Node22.22.3。只修改 tracked `tests/unit/dependency-remediation.test.ts`，新增两项行为测试，保留原六项。

- proxy-addr：单/多信任网段中，拒绝 `::/1` 和错误映射前缀误信外部 IPv4/IPv4-mapped 客户端；验证伪造 X-Forwarded-For 不改变客户端地址，合法 IPv4、完整 mapped 前缀和原生 IPv6 信任仍工作。
- source-map-js：平面 source-map 内容/位置往返、普通 indexed map 保持；巨大 offset、嵌套累计 offset、非法 line/column 拒绝。恶意完整消费路径只在独立子进程运行：5秒硬超时、SIGKILL、64MiB old-space、64KiB日志缓冲上限。子进程错误、信号或非0均令测试失败。

隔离小包测试：已核验 tar 解到本目录 `patched/node_modules`，测试文件为与 tracked 源码完全相同的副本；proxy 的 forwarded/ipaddr.js 使用原共享包只读链接。`regression-results.json`记录实际路径、命令、起止、exit与日志哈希。没有安装或改变共享node_modules。安装于原仓库的两包仍为旧版，本证据不能冒充干净全仓npm ci/CI。

结果：

- 修复版本 proxy-addr2.0.8/source-map-js1.2.2：完整文件 **8/8 PASS**，exit0。
- 旧版对照 proxy-addr2.0.7/source-map-js1.2.1：新增两项 **0 PASS/2 FAIL（预期）**，exit1。proxy在 `203.0.113.9` 对 `::/1` 的断言失败；source-map子进程达到64MiB old-space限制后SIGABRT，外层明确失败，未等待或卡死宿主事件循环。旧版对照驱动额外设置core dump上限0，未生成core文件。
- tracked测试文件 scoped ESLint：**PASS**，exit0。

这是有界包代码回归证据，不是完整应用兼容性或生产批准；原远程CI必须针对提交后的锁及测试执行。
