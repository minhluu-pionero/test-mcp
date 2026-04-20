#!/usr/bin/env node

// MCP (Model Context Protocol) server chạy qua stdio
// Giao tiếp với Claude Code bằng JSON-RPC 2.0 — mỗi request/response là một dòng JSON

import readline from "readline";

// Danh sách các tools mà server cung cấp cho client (Claude Code)
const tools = [
  {
    name: "get_time",
    description: "Get current server time",
    inputSchema: {
      type: "object",
      properties: {}
    }
  },
  {
    name: "echo",
    description: "Echo back input",
    inputSchema: {
      type: "object",
      properties: {
        message: { type: "string" }
      },
      required: ["message"]
    }
  },
  {
    name: "get_fake_figma_button",
    description: "Return a fake button from figma",
    inputSchema: {
      type: "object",
      properties: {}
    }
  }
];

// Xử lý từng JSON-RPC request từ client
function handleRequest(req) {
  const { id, method, params } = req;

  // Notification không có id và không cần trả response
  if (!id && method === "notifications/initialized") {
    return null;
  }

  // Handshake ban đầu: client gửi initialize, server trả về thông tin của mình
  if (method === "initialize") {
    return {
      jsonrpc: "2.0",
      id,
      result: {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "demo", version: "1.0.0" }
      }
    };
  }

  // Client hỏi danh sách tools có sẵn
  if (method === "tools/list") {
    return {
      jsonrpc: "2.0",
      id,
      result: { tools }
    };
  }

  // Client gọi một tool cụ thể
  if (method === "tools/call") {
    const { name, arguments: args } = params;
    let content;

    if (name === "get_time") {
      // Trả về thời gian hiện tại theo định dạng ISO 8601
      content = [{ type: "text", text: new Date().toISOString() }];
    } else if (name === "echo") {
      // Trả lại đúng message mà client gửi lên
      content = [{ type: "text", text: args.message }];
    } else if (name === "get_fake_figma_button") {
      // Trả về dữ liệu giả mô phỏng một button component từ Figma
      content = [{ type: "text", text: JSON.stringify({
        type: "button",
        text: "Submit",
        variant: "primary",
        padding: "12px 24px",
        color: "#1677ff"
      }) }];
    } else {
      // Tool không tồn tại
      return {
        jsonrpc: "2.0",
        id,
        error: { code: -32601, message: "Unknown tool: " + name }
      };
    }

    return { jsonrpc: "2.0", id, result: { content } };
  }

  // Method không được hỗ trợ
  return {
    jsonrpc: "2.0",
    id,
    error: { code: -32601, message: "Method not found: " + method }
  };
}

// Dùng readline để đọc stdin theo từng dòng.
// MCP dùng stdio làm kênh giao tiếp: Claude Code là process cha, server này là subprocess.
// Mỗi JSON-RPC message kết thúc bằng "\n" → readline tách thành từng message hoàn chỉnh.
// Nếu dùng process.stdin.on("data") thay thế, dữ liệu có thể đến theo chunk bị cắt giữa chừng,
// phải tự ghép lại — readline xử lý điều đó sẵn.
const rl = readline.createInterface({ input: process.stdin });

rl.on("line", (line) => {
  try {
    // Mỗi dòng là một JSON-RPC request — parse và xử lý
    const req = JSON.parse(line);
    const res = handleRequest(req);
    // Chỉ ghi ra stdout nếu có response (notification không cần trả lời)
    if (res) process.stdout.write(JSON.stringify(res) + "\n");
  } catch (e) {
    // Lỗi parse JSON — trả về lỗi chuẩn JSON-RPC
    process.stdout.write(JSON.stringify({
      jsonrpc: "2.0",
      id: null,
      error: { code: -32700, message: "Parse error" }
    }) + "\n");
  }
});
