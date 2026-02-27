# 阶段一：编译
FROM golang:1.21-alpine AS builder
# 设置代理加速
ENV GOPROXY=https://goproxy.cn,direct
WORKDIR /build
COPY go.mod go.sum ./
RUN go mod download
COPY . .
# 禁用 CGO，确保能在 alpine 运行
RUN CGO_ENABLED=0 GOOS=linux go build -o poker_server main.go

# 阶段二：运行
FROM alpine:latest
# 安装时区数据，防止日志时间对不上
RUN apk add --no-cache tzdata
ENV TZ=Asia/Shanghai
WORKDIR /app
COPY --from=builder /build/poker_server .
# 如果你有 config 文件夹，取消下面这行的注释
# COPY --from=builder /build/config ./config

# 这里的端口要和你 Go 代码里 ListenAndServe 的端口一致
EXPOSE 3000 
CMD ["./poker_server"]
