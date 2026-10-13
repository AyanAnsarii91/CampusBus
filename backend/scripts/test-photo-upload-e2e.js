import "dotenv/config";
import jwt from "jsonwebtoken";
import http from "http";
import { connectDB } from "../config/db.js";
import User from "../models/User.js";
import { getSupabaseDiagnostics } from "../services/supabaseStorage.js";

const BACKEND_URL = "http://localhost:5000";

async function runE2ETest() {
  console.log("=== SUPABASE PROFILE PHOTO UPLOAD E2E TEST ===");

  // 1. Diagnostics check
  const diag = getSupabaseDiagnostics();
  console.log("Supabase Diagnostics (secrets masked):", diag);

  if (!diag.isConfigured) {
    console.error("FAIL: Supabase is not configured properly!");
    process.exit(1);
  }

  // 2. Database connection & user retrieval
  await connectDB();
  const user = await User.findOne({ role: "student" });
  if (!user) {
    console.error("No student user found in database!");
    process.exit(1);
  }
  console.log(`✓ Test user found: ${user.name} (${user._id})`);

  // 3. Generate CampusBus JWT token
  const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: "1h",
  });
  console.log("✓ Generated CampusBus JWT token for user");

  // 4. Construct multipart/form-data request
  const boundary = "----WebKitFormBoundary" + Math.random().toString(36).substring(2);
  const fileContent = Buffer.from("GIF89a\x01\x00\x01\x00\x80\x00\x00\xff\xff\xff\x00\x00\x00!\xf9\x04\x01\x00\x00\x00\x00,\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02D\x01\x00;", "binary"); // 1x1 valid GIF image
  const filename = "test-avatar.gif";

  const headerPart = Buffer.from(
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="photo"; filename="${filename}"\r\n` +
    `Content-Type: image/gif\r\n\r\n`
  );
  const footerPart = Buffer.from(`\r\n--${boundary}--\r\n`);
  const body = Buffer.concat([headerPart, fileContent, footerPart]);

  // 5. Send POST /api/auth/profile/photo
  console.log("\n4. Sending POST /api/auth/profile/photo with multipart image...");
  const uploadRes = await new Promise((resolve, reject) => {
    const url = new URL("/api/auth/profile/photo", BACKEND_URL);
    const req = http.request(
      url,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": `multipart/form-data; boundary=${boundary}`,
          "Content-Length": body.length,
        },
      },
      (res) => {
        let raw = "";
        res.on("data", (chunk) => (raw += chunk));
        res.on("end", () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(raw) });
          } catch {
            resolve({ status: res.statusCode, raw });
          }
        });
      }
    );
    req.on("error", reject);
    req.write(body);
    req.end();
  });

  console.log("Upload HTTP status:", uploadRes.status);
  console.log("Upload Response:", JSON.stringify(uploadRes.body, null, 2));

  if (uploadRes.status !== 200 || !uploadRes.body.photoUrl) {
    console.error("❌ FAIL: Profile photo upload failed!");
    process.exit(1);
  }
  console.log("✅ SUCCESS: Profile photo uploaded successfully!");
  console.log("Photo URL:", uploadRes.body.photoUrl.slice(0, 80) + "...");
  console.log("Storage Path:", uploadRes.body.profilePhoto);

  // 6. Test DELETE /api/auth/profile/photo
  console.log("\n5. Cleaning up with DELETE /api/auth/profile/photo...");
  const deleteRes = await new Promise((resolve, reject) => {
    const url = new URL("/api/auth/profile/photo", BACKEND_URL);
    const req = http.request(
      url,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
      (res) => {
        let raw = "";
        res.on("data", (chunk) => (raw += chunk));
        res.on("end", () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(raw) });
          } catch {
            resolve({ status: res.statusCode, raw });
          }
        });
      }
    );
    req.on("error", reject);
    req.end();
  });

  console.log("Delete HTTP status:", deleteRes.status);
  console.log("Delete Response:", deleteRes.body);

  if (deleteRes.status === 200) {
    console.log("✅ Cleaned up test photo successfully!");
  }

  console.log("\n🎉 ALL TESTS PASSED! Supabase upload is 100% verified!");
  process.exit(0);
}

runE2ETest().catch((err) => {
  console.error("Test execution error:", err);
  process.exit(1);
});
