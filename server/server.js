const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const QRCode = require("qrcode");
const sharp = require("sharp");

const app = express();
const PORT = 5000;
const multer = require("multer");

// Configurar CORS y Body Parser con límites aumentados
app.use(cors());
app.use(bodyParser.json({ limit: "50mb" }));
app.use(bodyParser.urlencoded({ extended: true, limit: "50mb" }));

// Configuración de almacenamiento de multer
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.join(__dirname, "uploads");
    if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath); // Crear carpeta uploads si no existe
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + "-" + file.originalname);
  },
});
const upload = multer({ storage: storage });

// Crear carpeta `uploads` si no existe
const fs = require("fs");
if (!fs.existsSync("uploads")) {
  fs.mkdirSync("uploads");
}

// Middleware para loguear el cuerpo de la solicitud
app.use((req, res, next) => {
  console.log("Cuerpo recibido:", req.body);
  next();
});

app.post(
  "/generate-qrcode",
  upload.single("file"), // Middleware para manejar un archivo por petición
  async (req, res) => {
    console.log("Cuerpo recibido por el servidor:", req.body);
    console.log("Archivo recibido:", req.file);

    const {
      type,
      text,
      items,
      ssid,
      password,
      encryption,
      links,
      name,
      email,
      phone,
      address,
      company,
      jobTitle,
      website,
      birthday,
      couponCode,
      discount,
      expiration,
      title,
      description,
      ...rest
    } = req.body;

    if (!type) {
      return res.status(400).json({ error: 'El campo "type" es obligatorio' });
    }

    let qrData;

    try {
      switch (type) {
        case "WiFi":
          if (!ssid) {
            throw new Error('El campo "ssid" es obligatorio para WiFi');
          }
          qrData = `WIFI:T:${encryption || "WPA"};S:${ssid};P:${
            password || ""
          };H:;`;
          break;

        case "Menu":
          if (!items || !Array.isArray(items) || items.length === 0) {
            throw new Error(
              'El campo "items" debe ser un array con al menos un elemento para Menu'
            );
          }
          qrData = items
            .map(
              (item, index) =>
                `${index + 1}. ${item.name} - ${item.price} (${item.link || ""})`
            )
            .join("\n");
          break;

        case "Website":
          if (!text) {
            throw new Error('El campo "text" es obligatorio para Website');
          }
          qrData = text;
          break;

        case "PDF":
          if (!text && !req.file) {
            throw new Error(
              'Debe proporcionar una URL o subir un archivo PDF para el tipo "PDF"'
            );
          }

          if (text) {
            qrData = `PDF URL: ${text}`;
          }

          if (req.file) {
            qrData = `Archivo PDF: ${req.file.path}`;
          }

          if (title) {
            qrData = `Título: ${title}\n${qrData}`;
          }

          if (description) {
            qrData += `\nDescripción: ${description}`;
          }

          if (expiration) {
            qrData += `\nFecha de Expiración: ${expiration}`;
          }
          console.log("QR Data generado para PDF:", qrData);
          break;

        case "VCard":
          if (!name || !phone || !email) {
            throw new Error(
              'Los campos "name", "phone" y "email" son obligatorios para VCard'
            );
          }
          qrData = `BEGIN:VCARD
VERSION:3.0
FN:${name}
TEL:${phone}
EMAIL:${email}
${address ? `ADR:${address}` : ""}
${company ? `ORG:${company}` : ""}
${jobTitle ? `TITLE:${jobTitle}` : ""}
${website ? `URL:${website}` : ""}
${birthday ? `BDAY:${birthday}` : ""}
END:VCARD`;
          break;

        case "Cupon":
          if (!couponCode || !discount) {
            throw new Error(
              'Los campos "couponCode" y "discount" son obligatorios para Cupon'
            );
          }
          qrData = `Cupón: ${couponCode}\nDescuento: ${discount}\n${
            expiration ? `Válido hasta: ${expiration}` : ""
          }`;
          break;

        default:
          throw new Error(`El tipo "${type}" no es soportado.`);
      }

      // Generar QR básico
      const qrCodeBuffer = await QRCode.toBuffer(qrData, {
        color: {
          dark: rest.dotColor || "#000000",
          light: "#FFFFFF",
        },
      });

      // Opcional: agregar marco, logo, etc.
      let qrImage = sharp(qrCodeBuffer);
      if (rest.frameText) {
        const frameSVG = Buffer.from(`
            <svg width="500" height="550">
              <rect width="500" height="500" fill="${
                rest.frameColor || "#FFFFFF"
              }" />
              <text x="50%" y="95%" font-size="30" text-anchor="middle" fill="black">${
                rest.frameText
              }</text>
            </svg>
          `);
        qrImage = qrImage.composite([{ input: frameSVG, top: 0, left: 0 }]);
      }

      if (rest.logo) {
        const logoBuffer = Buffer.from(rest.logo, "base64");
        const resizedLogo = await sharp(logoBuffer).resize(50, 50).toBuffer();
        qrImage = qrImage.composite([
          { input: resizedLogo, gravity: "center", blend: "over" },
        ]);
      }

      // Generar y devolver la imagen QR final
      const finalQRCode = await qrImage.png().toBuffer();
      res.json({
        qrCodeImage: `data:image/png;base64,${finalQRCode.toString("base64")}`,
      });
    } catch (error) {
      console.error("Error generando el QR:", error.message || error);
      res.status(400).json({ error: error.message || "Error generando el QR" });
    }
  }
);

// // Servir el frontend React compilado
// app.use(express.static(path.join(__dirname, "../client/build")));
// app.get("*", (req, res) => {
//   res.sendFile(path.join(__dirname, "../client/build/index.html"));
// });


app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
