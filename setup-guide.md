# APISIX 环境搭建指南

本文档记录了在 MAC 电脑上从零开始搭建 APISIX 环境的详细步骤。

## 前置条件

1. 安装 Docker 和 Docker Compose
2. 确保有足够的磁盘空间（建议至少 10GB）
3. 确保 9080、9443、9180、9092、9000、2379 端口未被占用

## 步骤 1：创建项目目录

```bash
mkdir -p ~/work/codes/company/apisix
cd ~/work/codes/company/apisix
```

## 步骤 2：创建必要的目录结构

```bash
mkdir -p conf logs apisix
```

## 步骤 3：创建配置文件

### 3.1 创建 docker-compose.yml

在项目根目录创建 `docker-compose.yml` 文件，内容如下：

```yaml
version: '3'
services:
  etcd:
    image: bitnami/etcd:3.5.9
    environment:
      - ETCD_ENABLE_V2=true
      - ALLOW_NONE_AUTHENTICATION=yes
      - ETCD_ADVERTISE_CLIENT_URLS=http://etcd:2379
    ports:
      - "2379:2379"
    volumes:
      - etcd_data:/bitnami/etcd
    networks:
      - apisix-network

  apisix:
    build:
      context: .
      dockerfile: Dockerfile
    depends_on:
      - etcd
    ports:
      - "9080:9080"
      - "9443:9443"
      - "9180:9180"
      - "9092:9092"
    environment:
      - APISIX_STAND_ALONE=true
    volumes:
      - ./conf/config.yaml:/usr/local/apisix/conf/config.yaml:ro
      - ./conf/schema.json:/usr/local/apisix/conf/schema.json:ro
      - ./logs:/usr/local/apisix/logs
      - ./apisix:/usr/local/apisix/apisix
    command: >
      sh -c "rm -f /usr/local/apisix/logs/worker_events.sock && /usr/bin/apisix init && /usr/bin/apisix init_etcd && /usr/local/openresty/bin/openresty -p /usr/local/apisix -g 'daemon off;'"
    networks:
      - apisix-network

  apisix-dashboard:
    image: apache/apisix-dashboard:3.0.1-alpine
    depends_on:
      - etcd
    ports:
      - "9000:9000"
    environment:
      - APISIX_STAND_ALONE=true
      - ETCD_ENDPOINTS=http://etcd:2379
      - ETCD_RETRY_TIMES=10
      - ETCD_RETRY_INTERVAL=5
    dns:
      - 8.8.8.8
      - 8.8.4.4
    volumes:
      - ./conf/apisix-dashboard.yaml:/usr/local/apisix-dashboard/conf/conf.yaml:ro
      - ./conf/schema_dashboard.json:/usr/local/apisix-dashboard/conf/schema.json:ro
    networks:
      - apisix-network

networks:
  apisix-network:
    driver: bridge

volumes:
  etcd_data:
    driver: local
```

### 3.2 创建 Dockerfile

在项目根目录创建 `Dockerfile` 文件，内容如下：

```dockerfile
FROM apache/apisix:3.11.0-debian

# 安装必要的工具
RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/*

# 设置工作目录
WORKDIR /usr/local/apisix

# 复制配置文件
COPY conf/config.yaml /usr/local/apisix/conf/config.yaml
COPY conf/schema.json /usr/local/apisix/conf/schema.json

# 暴露端口
EXPOSE 9080 9443 9180 9092

# 启动命令
CMD ["sh", "-c", "rm -f /usr/local/apisix/logs/worker_events.sock && /usr/bin/apisix init && /usr/bin/apisix init_etcd && /usr/local/openresty/bin/openresty -p /usr/local/apisix -g 'daemon off;'"]
```

### 3.3 创建配置文件

在 `conf` 目录下创建以下配置文件：

1. `config.yaml` - APISIX 主配置文件
2. `apisix-dashboard.yaml` - Dashboard 配置文件
3. `schema.json` - APISIX schema 文件
4. `schema_dashboard.json` - Dashboard schema 文件

## 步骤 4：生成 Schema 文件

```bash
# 启动服务
docker-compose up -d

# 等待服务完全启动后，生成 schema 文件
docker exec apisix-apisix-1 curl -H "X-API-KEY: edd1c9f034335f136f87ad84b625c8f1" http://127.0.0.1:9180/v1/schema > conf/schema.json
docker exec apisix-apisix-dashboard-1 curl http://127.0.0.1:9000/v1/schema > conf/schema_dashboard.json
```

## 步骤 5：验证服务

1. 检查 APISIX 服务：
```bash
curl http://127.0.0.1:9080/apisix/admin/services
```

2. 检查 Dashboard：
```bash
curl http://127.0.0.1:9000
```

3. 检查 etcd 连接：
```bash
docker exec apisix-apisix-dashboard-1 wget -qO- http://etcd:2379/health
```

## 步骤 6：访问 Dashboard

打开浏览器访问：http://localhost:9000

## 常见问题处理

1. 如果遇到 worker_events.sock 文件占用问题：
```bash
rm -f logs/worker_events.sock
docker-compose restart apisix
```

2. 如果需要重启所有服务：
```bash
docker-compose down
docker-compose up -d
```

3. 如果需要查看服务日志：
```bash
docker-compose logs -f [service_name]
```

## 注意事项

1. 确保所有配置文件的权限正确
2. 确保端口未被其他服务占用
3. 如果修改了配置文件，需要重启相应的服务才能生效
4. 建议定期备份 etcd 数据 