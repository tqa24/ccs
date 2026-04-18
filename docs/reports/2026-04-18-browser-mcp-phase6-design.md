# Browser MCP Phase 6 Design

Last Updated: 2026-04-18

## Goal

在 `feat/browser-mcp-hover-phase6` worktree 中，为 CCS-managed `ccs-browser` MCP runtime 设计 Browser MCP Phase 6。
本阶段延续既有 browser MCP 能力蓝图，优先聚焦 network interception / mock responses，并保持 Phase 1-5 一致的最小增量策略。

Phase 6 不在当前阶段一次性做完整网络代理层，而是拆成两个连续子阶段：

- **Phase 6A**：request observation + scoped interception skeleton
- **Phase 6B**：mock responses

## Scope Summary

### In Scope for Phase 6A

- 新增会话级 interception rule 管理能力
- 新增近期请求摘要查看能力
- 基于目标页建立 Fetch interception 会话
- 支持最小匹配集：`urlIncludes`、`method`
- 支持最小动作集：`continue`、`fail`
- 维持 session-local state，不做跨 runtime 重启持久化

### Deferred to Phase 6B

- `fulfill` / mock response action
- 自定义 status / headers / body
- response body 编码与更复杂序列化
- 更复杂的匹配条件，如资源类型、headers、正则、优先级
- 浏览器级或跨页共享拦截规则

## Architecture

Phase 6 继续沿用现有 `lib/mcp/ccs-browser-server.cjs` 单 runtime 架构，不额外引入第二套 browser server，也不改写当前页面选择与工具注册模型。

现有 runtime 已具备两类基础能力：

- 页面级 CDP 请求发送：`sendCdpCommand(page, method, params)`
- 事件型 websocket 监听：当前 `browser_wait_for_event` 已能在页级 websocket 上启用 `Page.enable` / `Network.enable`

Phase 6 在这一基础上增加一层 **session-local interception state**，而不是引入新的全局配置层。

整体结构分为三层：

1. **Tool surface**：新增规则管理和请求查看工具
2. **Session-local state**：记录规则、近期请求和页级 interception session
3. **Page interception session**：在具体 page target 上维护 Fetch domain 长连接，处理 paused requests

## Tool Surface

Phase 6A 先只新增四个工具，形成最小闭环。

### `browser_add_intercept_rule`

为某个页面添加一条会话级拦截规则。

建议参数：

- `pageIndex?: number`
- `pageId?: string`
- `urlIncludes?: string`
- `method?: string`
- `action: "continue" | "fail"`

行为：

- 如果省略 `pageIndex/pageId`，按调用当下的 selected page 解析一次目标页
- 解析结果固化为具体 `pageId`
- 创建 ruleId 并返回
- 若目标页尚未建立 interception session，则启动该页的 Fetch interception 长连接

### `browser_remove_intercept_rule`

按 `ruleId` 删除一条规则。

建议参数：

- `ruleId: string`

行为：

- 删除对应规则
- 如果某页已无任何规则，回收该页 interception session

### `browser_list_intercept_rules`

列出当前 MCP runtime 内存中的有效规则。

返回字段最小化，建议包含：

- `ruleId`
- `pageId`
- `pageTitle`
- `urlIncludes`
- `method`
- `action`

### `browser_list_requests`

返回近期观测到的请求摘要。

建议参数：

- `pageIndex?: number`
- `pageId?: string`
- `limit?: number`

返回字段最小化，建议包含：

- `requestId`
- `pageId`
- `url`
- `method`
- `resourceType`
- `matchedRuleId`
- `action`

## State Model

Phase 6A 在 runtime 内维护三块 session-local 状态：

### `interceptRules`

存储当前有效规则列表。每条规则至少包含：

- `ruleId`
- `pageId`
- `pageTitleSnapshot`
- `urlIncludes`
- `method`
- `action`
- `createdAt`

关键约束：

- 规则绑定到**创建时解析出的具体 pageId**
- 规则不会在后续切换 selected page 时自动漂移
- 规则不持久化到磁盘

### `recentRequests`

存储近期请求摘要，供 `browser_list_requests` 使用。

关键约束：

- 固定上限，建议 100 条
- 超过上限时丢弃最旧记录
- 只保留摘要，不保留 body

### `interceptSessionsByPageId`

存储每个被拦截页面对应的长连接会话。

每个 session 至少需要管理：

- `pageId`
- `webSocketDebuggerUrl`
- websocket 实例
- 当前是否已启用 `Fetch.enable`
- 关联规则数量
- 最近错误状态（如果需要）

## Data Flow

### Add Rule Flow

1. `browser_add_intercept_rule` 解析目标页
2. 校验参数与最小匹配条件
3. 生成 `ruleId`
4. 将规则写入 `interceptRules`
5. 为目标页创建或复用 interception session
6. 在该页 websocket 上启用 `Fetch.enable`
7. 返回 rule 摘要

### Request Interception Flow

1. 页级 interception session 收到 paused request 事件
2. 从该页规则中按创建顺序依次匹配
3. 第一条命中规则决定动作
4. 执行动作：
   - `continue` -> 放行请求
   - `fail` -> 以固定错误原因中止请求
5. 写入 `recentRequests`
6. 若无命中规则，则默认 `continue`

### Remove Rule Flow

1. `browser_remove_intercept_rule` 按 `ruleId` 找到规则
2. 从 `interceptRules` 删除
3. 若规则所属页已无剩余规则，则关闭该页 interception session
4. 返回删除结果

### List Requests Flow

1. `browser_list_requests` 按可选 page filter 过滤
2. 按时间倒序返回近期摘要
3. 应用 `limit`

## Error Handling and Boundary Rules

### Parameter Rules

`browser_add_intercept_rule`：

- `pageIndex` 和 `pageId` 不能同时传
- `action` 只能是 `continue` 或 `fail`
- 至少要有一个匹配条件：`urlIncludes` 或 `method`
- 目标页不存在、已关闭或无 websocket target 时直接报错

`browser_remove_intercept_rule`：

- `ruleId` 不存在时报错

`browser_list_requests`：

- `pageIndex` 和 `pageId` 不能同时传
- `limit` 越界时回退到安全默认值

### Lifecycle Rules

- 所有 interception 规则都是 session-local in-memory state
- 目标页关闭后，该页规则自动失效并从规则列表中清除
- `browser_list_intercept_rules` 只返回当前仍有效的规则
- runtime 重启后，所有规则和请求摘要都会丢失

### Concurrency Rules

- 规则管理工具继续沿用当前 runtime 的串行消息语义，避免状态竞态
- 真正的请求拦截事件在页级长连接中异步处理
- 页级拦截事件只允许修改自身 pageId 对应的 interception session 状态，以及共享的 `recentRequests`

## Interaction with Existing Phase 5 State

Phase 6 必须与现有 selected page 语义兼容：

- 添加规则时若省略目标页参数，只在创建当下读取 selected page 一次
- 规则创建完成后绑定到具体 pageId，不再受后续切页影响
- `browser_select_page`、`browser_open_page`、`browser_close_page` 不直接重写既有规则的 page binding
- 如果 `browser_close_page` 关闭了被规则绑定的页面，相关规则应自动清理

## Testing Strategy

Phase 6A 测试应继续扩展 `tests/unit/hooks/ccs-browser-mcp-server.test.ts` 里的 deterministic harness。

最小测试集建议覆盖：

1. 工具列表与 schema 暴露正确
2. 添加规则后能在规则列表中看到
3. 删除规则后规则消失
4. 两条规则按创建顺序匹配，先命中者生效
5. 省略 `pageIndex/pageId` 时按当前 selected page 绑定
6. 切换 selected page 后，旧规则仍绑定原 pageId
7. 关闭绑定页面后规则自动清理
8. `browser_list_requests` 只返回摘要并 obey `limit`
9. 无命中规则时默认 continue
10. `fail` 动作能生成稳定且可断言的结果

## Why This Split

将 Phase 6 拆成 6A / 6B 的原因是：

- 先稳定规则管理、页级会话和 paused request 生命周期
- 再叠加 mock fulfill response，避免一开始把匹配、状态管理、headers/body 序列化全耦合到一起
- 与 Phase 1-5 的最小闭环推进方式保持一致

6A 解决的是“能稳定地拦住并控制请求”；6B 再解决“能把响应内容完全替换掉”。

## Out of Scope in This Design Pass

本轮设计确认只覆盖 Phase 6 的拆分方式与 6A 的最小闭环，不直接进入 6B 的详细实现步骤，也不在这里展开 implementation plan。
