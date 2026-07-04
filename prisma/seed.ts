import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding Brain OS...");

  // Profile
  const profile = await prisma.profile.upsert({
    where: { id: "owner-001" },
    update: {},
    create: {
      id: "owner-001",
      name: "Chủ hệ thống",
      alias: "Owner",
      bio: "Brain OS — hệ thống trí nhớ dài hạn và điều phối thiết bị.",
      timezone: "Asia/Ho_Chi_Minh",
      locale: "vi",
    },
  });

  // Preferences
  await prisma.preference.createMany({
    skipDuplicates: true,
    data: [
      { profile_id: profile.id, key: "theme", value: "dark", group: "ui" },
      { profile_id: profile.id, key: "language", value: "vi", group: "ui" },
      { profile_id: profile.id, key: "default_access_level", value: "3", group: "security" },
    ],
  });

  // Projects
  const projects = await Promise.all([
    prisma.project.upsert({
      where: { slug: "brain-os" },
      update: {},
      create: {
        name: "Brain OS",
        slug: "brain-os",
        description: "Hệ thống trí nhớ dài hạn và điều phối toàn bộ hệ sinh thái.",
        status: "active",
        color: "#6366f1",
        pinned: true,
      },
    }),
    prisma.project.upsert({
      where: { slug: "robot-chinchin" },
      update: {},
      create: {
        name: "Robot ChinChin",
        slug: "robot-chinchin",
        description: "Robot tự hành — interface vật lý của Brain OS.",
        status: "active",
        color: "#f59e0b",
      },
    }),
    prisma.project.upsert({
      where: { slug: "ruaanh-vn" },
      update: {},
      create: {
        name: "ruaanh.vn",
        slug: "ruaanh-vn",
        description: "Website / platform ruaanh.vn.",
        status: "active",
        color: "#10b981",
      },
    }),
    prisma.project.upsert({
      where: { slug: "chinchin" },
      update: {},
      create: {
        name: "ChinChin",
        slug: "chinchin",
        description: "AI assistant / companion.",
        status: "active",
        color: "#ec4899",
      },
    }),
    prisma.project.upsert({
      where: { slug: "onigiri-city" },
      update: {},
      create: {
        name: "Onigiri City",
        slug: "onigiri-city",
        description: "Project sáng tạo / game / world-building.",
        status: "paused",
        color: "#8b5cf6",
      },
    }),
  ]);

  // Devices
  await prisma.device.createMany({
    skipDuplicates: true,
    data: [
      {
        id: "dev-laptop-main",
        name: "Laptop chính",
        device_type: "laptop",
        description: "Máy tính làm việc chính.",
        status: "online",
        capabilities: ["browser", "terminal", "camera"],
      },
      {
        id: "dev-laptop-robot",
        name: "Laptop robot",
        device_type: "laptop",
        description: "Laptop điều khiển robot ChinChin.",
        status: "offline",
        capabilities: ["ros", "serial", "camera"],
      },
      {
        id: "dev-tv",
        name: "TV",
        device_type: "tv",
        description: "Màn hình TV trong nhà.",
        status: "offline",
        capabilities: ["display", "browser"],
      },
      {
        id: "dev-c920",
        name: "C920",
        device_type: "camera",
        description: "Webcam Logitech C920.",
        status: "offline",
        capabilities: ["video", "face_detect"],
      },
      {
        id: "dev-esp32-robot",
        name: "ESP32-S3 Robot",
        device_type: "esp32",
        description: "Microcontroller điều khiển động cơ robot.",
        status: "offline",
        capabilities: ["motor", "sensor", "wifi", "serial"],
      },
      {
        id: "dev-robot-simulator",
        name: "Robot ChinChin Web Simulator",
        device_type: "robot",
        description: "Robot ảo chạy trên web — mô phỏng cho Robot ChinChin trước khi nối ESP32/C920/TV thật.",
        status: "online",
        capabilities: ["face", "speak", "turn"],
      },
    ],
  });

  // Robot Simulator — trạng thái mặc định
  await prisma.robotState.upsert({
    where: { device_id: "dev-robot-simulator" },
    update: {},
    create: {
      device_id: "dev-robot-simulator",
      mode: "idle",
      face: "idle",
      battery: 100,
    },
  });

  // Decisions
  const brainOsProject = projects[0];
  await prisma.decision.createMany({
    skipDuplicates: true,
    data: [
      {
        id: "dec-001",
        title: "Brain OS là não chính",
        rationale: "Mọi dữ liệu, trí nhớ, quyết định đều lưu tại Brain OS. Các thiết bị và app chỉ là interface.",
        outcome: "Kiến trúc hub-and-spoke — Brain OS ở trung tâm.",
        status: "active",
        project_id: brainOsProject.id,
        tags: ["architecture", "core"],
      },
      {
        id: "dec-002",
        title: "Robot chỉ là interface của Brain OS",
        rationale: "Không hard-code logic robot vào core. Robot nhận lệnh qua Device API.",
        outcome: "Robot là một Device, kết nối qua connector.",
        status: "active",
        project_id: brainOsProject.id,
        tags: ["robot", "architecture"],
      },
      {
        id: "dec-003",
        title: "Không dùng n8n ở MVP",
        rationale: "Tránh phụ thuộc external orchestrator. MVP tự xử lý logic.",
        outcome: "Connector n8n chỉ là placeholder, enable sau.",
        status: "active",
        project_id: brainOsProject.id,
        tags: ["mvp", "connector"],
      },
      {
        id: "dec-004",
        title: "Có Private Vault (PrivateMemory)",
        rationale: "Thông tin riêng tư cần tách khỏi memory thông thường, có access_level riêng.",
        outcome: "PrivateMemory = bảng riêng, access_level >= 3.",
        status: "active",
        project_id: brainOsProject.id,
        tags: ["security", "vault"],
      },
      {
        id: "dec-005",
        title: "Không lưu ảnh mặt gốc mặc định",
        rationale: "Privacy. Chỉ lưu face_embedding (vector placeholder). store_raw = false.",
        outcome: "FaceProfile.store_raw = false. Không upload raw image lên server.",
        status: "active",
        project_id: brainOsProject.id,
        tags: ["privacy", "face", "security"],
      },
    ],
  });

  // Sample memories
  await prisma.memory.createMany({
    skipDuplicates: true,
    data: [
      {
        id: "mem-001",
        title: "Kiến trúc Brain OS",
        content: "Brain OS là hub trung tâm. Các module: Profile, Memory, PrivateMemory, People, Projects, Tasks, Decisions, Prompts, Devices, Connectors, ActivityLogs.",
        tags: ["architecture", "brain-os"],
        category: "system",
        access_level: 1,
        project_id: brainOsProject.id,
        pinned: true,
      },
      {
        id: "mem-002",
        title: "Stack kỹ thuật hiện tại",
        content: "Next.js App Router, TypeScript, Tailwind, Prisma, PostgreSQL, Zod. Deploy target: self-hosted hoặc Vercel.",
        tags: ["tech", "stack"],
        category: "technical",
        access_level: 1,
        project_id: brainOsProject.id,
      },
    ],
  });

  // Connectors (disabled by default)
  await prisma.connector.createMany({
    skipDuplicates: true,
    data: [
      { id: "conn-telegram", name: "Telegram Bot", connector_type: "telegram", enabled: false, description: "Bot Telegram nhận lệnh và gửi thông báo." },
      { id: "conn-n8n", name: "n8n Webhook", connector_type: "n8n", enabled: false, description: "Tích hợp n8n automation. Chưa dùng ở MVP." },
      { id: "conn-ruaanh", name: "ruaanh.vn", connector_type: "ruaanh", enabled: false, description: "Sync dữ liệu với ruaanh.vn." },
      { id: "conn-robot", name: "Robot ChinChin", connector_type: "robot", enabled: false, description: "Interface điều khiển robot qua Device API." },
    ],
  });

  console.log("Seed done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
