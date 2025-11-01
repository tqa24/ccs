# CCS - Claude Code Switch

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Bash](https://img.shields.io/badge/bash-3.2%2B-blue.svg)](https://www.gnu.org/software/bash/)
[![GitHub Stars](https://img.shields.io/github/stars/kaitranntt/ccs.svg)](https://github.com/kaitranntt/ccs/stargazers)

**Ngôn ngữ**: [English](README.md) | [Tiếng Việt](README.vi.md)

> Chuyển đổi giữa Claude Sonnet 4.5 và GLM 4.6 ngay lập tức. Dùng đúng model cho từng tác vụ.

**Vấn đề**: Bạn có cả Claude subscription và GLM Coding Plan. Hai tình huống xảy ra hàng ngày:
1. **Rate limit**: Claude hết lượt giữa chừng project, phải tự tay sửa file `~/.claude/settings.json` để chuyển
2. **Tối ưu công việc**: Planning phức tạp cần trí tuệ của Claude Sonnet 4.5, nhưng coding đơn giản thì GLM 4.6 vẫn làm tốt

Chuyển đổi thủ công rất mất thời gian và dễ sai.

**Giải pháp**:
```bash
ccs son       # Refactoring phức tạp? Dùng Claude Sonnet 4.5
ccs glm       # Fix bug đơn giản? Dùng GLM 4.6
# Hết rate limit? Chuyển ngay:
ccs glm       # Tiếp tục làm việc với GLM
```

Một lệnh. Không downtime. Không phải sửa file. Đúng model, đúng việc.

## Bắt Đầu Nhanh

**Cài đặt** (một dòng lệnh):
```bash
curl -fsSL ccs.kaitran.ca/install | bash
```

**Cấu hình**:
```bash
# Sửa theo profile của bạn
cat > ~/.ccs.json << 'EOF'
{
  "profiles": {
    "glm": "~/.claude/glm.settings.json",
    "son": "~/.claude/sonnet.settings.json",
    "default": "~/.claude/settings.json"
  }
}
EOF
```

**Sử dụng**:
```bash
ccs          # Dùng profile mặc định
ccs glm      # Dùng GLM profile
ccs son      # Dùng Sonnet profile
```

## Tại Sao Nên Dùng CCS?

### 🎯 Tối Ưu Theo Từng Tác Vụ

**Không có CCS**: Dùng Claude cho mọi thứ → Tốn chi phí, nhanh hết rate limit

**Có CCS**: Chuyển model theo độ phức tạp, tối đa hóa chất lượng mà vẫn quản lý được chi phí.

```bash
ccs son       # Planning kiến trúc tính năng mới
# Đã có plan? Code với GLM:
ccs glm       # Viết code đơn giản
```

### ⚡ Xử Lý Rate Limit

Nếu bạn có cả Claude subscription và GLM Coding Plan, bạn biết cái khổ:
- Claude hết rate limit giữa chừng
- Phải mở `~/.claude/settings.json`
- Copy-paste config từ file backup
- Lặp lại 10 lần mỗi ngày

**CCS giải quyết**:
- Một lệnh để chuyển: `ccs glm` hoặc `ccs son`
- Lưu cả hai config dạng profiles
- Chuyển trong <1 giây
- Không phải sửa file, không copy-paste, không sai sót

### 🔧 Tính Năng

- Zero config mặc định: installer tự tạo profiles
- Chuyển profile bằng một lệnh: `ccs glm`, `ccs son`
- Hỗ trợ profile tùy chỉnh không giới hạn
- Truyền toàn bộ args của Claude CLI
- Setup thông minh: tự nhận diện provider hiện tại
- Tự động tạo configs khi cài đặt
- Không proxy, không magic—chỉ bash + jq

## Cài Đặt

### Một Dòng Lệnh (Khuyến Nghị)

**URL ngắn** (qua CloudFlare):
```bash
curl -fsSL ccs.kaitran.ca/install | bash
```

**Trực tiếp từ GitHub**:
```bash
curl -fsSL https://raw.githubusercontent.com/kaitranntt/ccs/main/install.sh | bash
```

**Lưu ý**: Installer hỗ trợ cả chạy trực tiếp (`./install.sh`) và piped installation (`curl | bash`).

### Git Clone

```bash
git clone https://github.com/kaitranntt/ccs.git
cd ccs
./install.sh
```

**Lưu ý**: Hoạt động với git worktrees và submodules - installer phát hiện cả `.git` directory và `.git` file.

### Thủ Công

```bash
# Tải script
curl -fsSL https://raw.githubusercontent.com/kaitranntt/ccs/main/ccs -o ~/.local/bin/ccs
chmod +x ~/.local/bin/ccs

# Đảm bảo ~/.local/bin trong PATH
export PATH="$HOME/.local/bin:$PATH"
```

### Nâng Cấp

**Từ git clone**:
```bash
cd ccs && git pull && ./install.sh
```

**Từ curl install**:
```bash
# URL ngắn
curl -fsSL ccs.kaitran.ca/install | bash

# Hoặc trực tiếp từ GitHub
curl -fsSL https://raw.githubusercontent.com/kaitranntt/ccs/main/install.sh | bash
```

**Lưu ý**: Nâng cấp giữ nguyên API keys và settings hiện tại. Installer chỉ thêm tính năng mới mà không ghi đè cấu hình của bạn.

## Cấu Hình

Installer tự động tạo `~/.ccs.json` và profile templates khi cài đặt. Nếu cần tùy chỉnh:

```json
{
  "profiles": {
    "glm": "~/.claude/glm.settings.json",
    "son": "~/.claude/sonnet.settings.json",
    "default": "~/.claude/settings.json"
  }
}
```

Mỗi profile trỏ đến một file settings JSON của Claude. Tạo file settings theo [tài liệu Claude CLI](https://docs.claude.com/en/docs/claude-code/installation).

### Cấu Hình GLM Profile

Installer tự động cấu hình GLM profiles với các biến môi trường nâng cao:

```json
{
  "env": {
    "ANTHROPIC_BASE_URL": "https://api.z.ai/api/anthropic",
    "ANTHROPIC_AUTH_TOKEN": "GLM_API_KEY_CUA_BAN",
    "ANTHROPIC_MODEL": "glm-4.6",
    "ANTHROPIC_DEFAULT_OPUS_MODEL": "glm-4.6",
    "ANTHROPIC_DEFAULT_SONNET_MODEL": "glm-4.6",
    "ANTHROPIC_DEFAULT_HAIKU_MODEL": "glm-4.6"
  }
}
```

**Các biến môi trường**:
- `ANTHROPIC_DEFAULT_OPUS_MODEL`: Model mặc định cho requests Opus-class
- `ANTHROPIC_DEFAULT_SONNET_MODEL`: Model mặc định cho requests Sonnet-class
- `ANTHROPIC_DEFAULT_HAIKU_MODEL`: Model mặc định cho requests Haiku-class

Các biến này đảm bảo GLM được dùng làm provider mặc định khi chuyển profiles.

## Sử Dụng

### Cơ Bản

```bash
ccs           # Dùng profile mặc định (không args)
ccs glm       # Dùng GLM profile
ccs son       # Dùng Sonnet profile
```

### Với Arguments

Tất cả args sau tên profile được truyền trực tiếp cho Claude CLI:

```bash
ccs glm --verbose
ccs son /plan "thêm tính năng"
ccs default --model claude-sonnet-4
```

### Ví Dụ

**Tự động hoàn thành**:
```bash
# Nếu shell của bạn hỗ trợ aliases
alias cs='ccs'
cs glm
```

## Use Cases

### 1. Tích Hợp Thanh Toán

```bash
# Bước 1: Kiến trúc & Planning (cần trí tuệ của Claude)
ccs son
/plan "Thiết kế tích hợp thanh toán với Stripe, xử lý webhooks, errors, retries"
# → Claude Sonnet 4.5 suy nghĩ sâu về edge cases, bảo mật, kiến trúc

# Bước 2: Implement (coding đơn giản)
ccs glm
/code "implement payment handler theo plan"
# → GLM 4.6 viết code hiệu quả, tiết kiệm usage của Claude

# Bước 3: Code Review (cần phân tích sâu)
ccs son
/review "kiểm tra payment handler về vấn đề bảo mật"
# → Claude Sonnet 4.5 phát hiện các lỗ hổng tinh vi

# Bước 4: Testing & Fixes (công việc lặp lại)
ccs glm
/fix "sửa các issues từ review"
# → GLM 4.6 xử lý fixes đơn giản
```

### 2. Hết Rate Limit Giữa Chừng

```bash
# Đang làm refactoring phức tạp với Claude
ccs son
/plan "refactor hệ thống authentication"

# Claude hết rate limit giữa task
# ❌ TRƯỚC: Phải chờ hoặc manually sửa settings

# ✅ BÂY GIỜ: Chuyển ngay
ccs glm
# Tiếp tục làm việc không gián đoạn

# Rate limit reset? Chuyển lại
ccs son
```

### Ví Dụ Cấu Hình

**Nhiều GLM accounts cho rate limits cao hơn**:
```json
{
  "profiles": {
    "glm1": "~/.claude/glm-account1.settings.json",
    "glm2": "~/.claude/glm-account2.settings.json",
    "son": "~/.claude/sonnet.settings.json"
  }
}
```

**Profiles cho từng dự án**:
```json
{
  "profiles": {
    "work": "~/.claude/work.settings.json",
    "personal": "~/.claude/personal.settings.json",
    "experiments": "~/.claude/experiments.settings.json"
  }
}
```

## Yêu Cầu

- **Bash** 3.2+
- **jq** (để xử lý JSON)
- **Claude CLI** đã cài đặt

### Cài jq

**macOS**:
```bash
brew install jq
```

**Ubuntu/Debian**:
```bash
sudo apt install jq
```

**Fedora**:
```bash
sudo dnf install jq
```

**Arch**:
```bash
sudo pacman -S jq
```

## Troubleshooting

### Vấn Đề Cài Đặt

#### Lỗi BASH_SOURCE unbound variable

Lỗi này xảy ra khi chạy installer trong một số shells hoặc môi trường.

**Đã sửa trong phiên bản mới nhất**: Installer bây giờ xử lý cả piped execution (`curl | bash`) và direct execution (`./install.sh`).

**Giải pháp**: Nâng cấp lên phiên bản mới nhất:
```bash
curl -fsSL ccs.kaitran.ca/install | bash
```

#### Git worktree không được phát hiện

Nếu cài từ git worktree hoặc submodule, phiên bản cũ có thể không phát hiện git repository.

**Đã sửa trong phiên bản mới nhất**: Installer bây giờ phát hiện cả `.git` directory (standard clone) và `.git` file (worktree/submodule).

**Giải pháp**: Nâng cấp lên phiên bản mới nhất hoặc dùng curl installation.

### Vấn Đề Cấu Hình

#### Profile không tìm thấy

```
Error: Profile 'foo' not found in ~/.ccs.json
```

**Fix**: Thêm profile vào config:
```json
{
  "profiles": {
    "foo": "~/.claude/foo.settings.json"
  }
}
```

#### File settings thiếu

```
Error: Settings file not found: ~/.claude/foo.settings.json
```

**Fix**: Tạo file settings hoặc sửa path trong config.

#### jq chưa cài

```
Error: jq is required but not installed
```

**Fix**: Cài jq (xem phần Yêu Cầu).

**Lưu ý**: Installer tạo templates cơ bản ngay cả không có jq, nhưng các tính năng nâng cao cần jq.

### Vấn Đề Môi Trường

#### PATH chưa được thiết lập

```
⚠️  Warning: ~/.local/bin is not in PATH
```

**Fix**: Thêm vào shell profile (~/.bashrc hoặc ~/.zshrc):
```bash
export PATH="$HOME/.local/bin:$PATH"
```
Sau đó `source ~/.bashrc` hoặc khởi động lại shell.

#### Profile mặc định thiếu

```
Error: Profile 'default' not found in ~/.ccs.json
```

**Fix**: Thêm profile default:
```json
{
  "profiles": {
    "default": "~/.claude/settings.json"
  }
}
```

### Vấn Đề Nâng Cấp

#### API keys bị mất sau khi nâng cấp

**Không phải vấn đề**: Installer giữ nguyên API keys hiện tại khi nâng cấp. Nếu bạn đang dùng GLM, API key của bạn được tự động giữ lại và profile được nâng cấp với các biến default model mới.

**Xác minh**: Kiểm tra `~/.claude/glm.settings.json` - `ANTHROPIC_AUTH_TOKEN` của bạn vẫn còn đó.

## Gỡ Cài Đặt

**Dùng lệnh đã cài**:
```bash
ccs-uninstall
```

**Một dòng lệnh** (nếu ccs-uninstall không có):
```bash
# URL ngắn
curl -fsSL ccs.kaitran.ca/uninstall | bash

# Hoặc trực tiếp từ GitHub
curl -fsSL https://raw.githubusercontent.com/kaitranntt/ccs/main/uninstall.sh | bash
```

**Thủ công**:
```bash
rm ~/.local/bin/ccs
rm ~/.local/bin/ccs-uninstall
rm ~/.ccs.json  # Nếu muốn xóa config
```

## Bảo Mật

- ✅ Zero dependencies (chỉ bash + jq)
- ✅ Không internet calls ngoài cài đặt
- ✅ Không tracking, không telemetry
- ✅ Configs được lưu local
- ✅ Pass-through trực tiếp đến Claude CLI
- ✅ Open source, có thể audit

**Lưu ý**: CCS chỉ chuyển đổi file settings. Tất cả model execution được xử lý bởi Claude CLI chính thức.

## FAQ

**Q: CCS có gọi API không?**
A: Không. CCS chỉ chuyển đổi file config. Tất cả API calls đến từ Claude CLI chính thức.

**Q: Có thể dùng với các providers khác không?**
A: Có! Miễn là provider tương thích với Claude CLI settings format.

**Q: Cần internet để chuyển profiles không?**
A: Không. Profile switching hoàn toàn offline. Chỉ cần internet cho API calls của Claude CLI.

**Q: Settings cũ của tôi có bị ghi đè không?**
A: Không. Installer tạo files mới và giữ nguyên configs hiện tại.

**Q: CCS có hoạt động trên Windows không?**
A: CCS cần bash. Dùng WSL, Git Bash, hoặc Cygwin trên Windows.

## Đóng Góp

Contributions được chào đón! Vui lòng:

1. Fork repo
2. Tạo feature branch
3. Commit changes của bạn
4. Push lên branch
5. Mở Pull Request

## License

MIT License - xem [LICENSE](LICENSE) để biết chi tiết.

## Tác Giả

Được tạo bởi [Kai Tran](https://github.com/kaitranntt)

## Links

- **GitHub**: https://github.com/kaitranntt/ccs
- **Issues**: https://github.com/kaitranntt/ccs/issues
- **Claude CLI Docs**: https://docs.claude.com/en/docs/claude-code/installation

---

Nếu CCS giúp ích cho bạn, cho một ⭐ trên GitHub! 🎉
