require('dotenv').config();

const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const os = require('os');
const fe = require('fs');
const sharp = require('sharp');
const { spawn } = require('child_process');
const util = require('util');
const { PrismaClient } = require('@prisma/client');
const multer = require('multer');

// --- XSS Sanitization Setup ---
const createDOMPurify = require('dompurify');
const { JSDOM } = require('jsdom');
const window = new JSDOM('').window;
const DOMPurify = createDOMPurify(window);

function sanitizeText(input) {
  if (typeof input !== 'string') return input;
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: []
  });
}
// -----------------------------

const upload = multer({
  limits: {
    fileSize: 5 * 1024 * 1024 // 5 MB max
  }
});
const ALGORITHM = 'aes-256-cbc';

const prisma = new PrismaClient();

// --- Background process logic for pkg ---
// When the .exe is double-clicked on Windows, it runs without a console window.
if (typeof process.pkg !== 'undefined' && process.platform === 'win32' && !process.argv.includes('--background')) {
    // Re-launch the app as a detached background process
    const child = spawn(process.execPath, process.argv.slice(1).concat('--background'), {
        detached: true,
        stdio: 'ignore'
    });
    child.unref();
    process.exit();
}

const app = express();
const PORT = 3000;

// ✅ Detect if running inside pkg
const isPkg = typeof process.pkg !== 'undefined';
const baseDir = isPkg ? path.dirname(process.execPath) : __dirname;

// ✅ Helper to resolve bundled files properly (pkg or dev)
function getFilePath(file) {
  return isPkg ? path.join(__dirname, file) : path.join(__dirname, file);
}

// ✅ Serve HTML/JS from inside the .exe or from source folder
function serveBundledFile(res, fileName, contentType = 'text/html') {
  try {
    const filePath = getFilePath(fileName);
    const data = fe.readFileSync(filePath);
    res.setHeader('Content-Type', contentType);
    res.send(data);
  } catch (err) {
    console.error(`Failed to serve ${fileName}:`, err);
    res.status(500).send('Internal Server Error');
  }
}

// --- Data directory setup ---
const DATA_DIR = path.join(os.homedir(), 'Documents', 'MedicalCentersData');
if (!fe.existsSync(DATA_DIR)) {
  fe.mkdirSync(DATA_DIR, { recursive: true });
  console.log(`Created data directory: ${DATA_DIR}`);
}
// --- Logging setup ---
const LOG_FILE_PATH = path.join(DATA_DIR, 'app.log');
const logStream = fe.createWriteStream(LOG_FILE_PATH, { flags: 'a' });

const logToFile = (level, ...args) => {
  const message = util.format(...args);
  logStream.write(`[${new Date().toISOString()}] [${level}] ${message}\n`);
};
// ===============================
// 🔐 Audit Log (Security)
// ===============================
const AUDIT_LOG_FILE = path.join(DATA_DIR, 'audit.log');
/*
const AUDIT_DIR = '/var/log/medical-centers';  //                 -------------for vps
const AUDIT_LOG_FILE = path.join(AUDIT_DIR, 'audit.log');
if (!fe.existsSync(AUDIT_DIR)) {
  fe.mkdirSync(AUDIT_DIR, { recursive: true });
}
*/
function auditLog(req, payload) {
  try {
    const entry = {
      time: new Date().toISOString(),
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      user: req.session?.user
        ? {
            id: req.session.user.id,
            username: req.session.user.username,
            role: req.session.user.role
          }
        : null,
      ...payload
    };

    fe.appendFileSync(
      AUDIT_LOG_FILE,
      JSON.stringify(entry,null,2) + '\n\n'
      //{ mode: 0o600 }    vps
    );
  } catch (e) {
    console.error('AUDIT_LOG_ERROR:', e.message);
  }
}

// In packaged mode, when running as a background process, we don't want to write to the actual console.
const shouldWriteToConsole = typeof process.pkg === 'undefined' || !process.argv.includes('--background');

const originalConsoleLog = console.log;
console.log = (...args) => {
  logToFile('INFO', ...args);
  if (shouldWriteToConsole) {
    originalConsoleLog.apply(console, args);
  }
};

const originalConsoleError = console.error;
console.error = (...args) => {
  logToFile('ERROR', ...args);
  if (shouldWriteToConsole) {
    originalConsoleError.apply(console, args);
  }
};

const originalConsoleWarn = console.warn;
console.warn = (...args) => {
  logToFile('WARN', ...args);
  if (shouldWriteToConsole) {
    originalConsoleWarn.apply(console, args);
  }
};

process.on('uncaughtException', (err, origin) => {
  const msg = util.format('Uncaught exception:', err, '\nException origin:', origin);
  logToFile('FATAL', msg);
  if (shouldWriteToConsole) {
    originalConsoleError(msg);
  }
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  const msg = util.format('Unhandled Rejection at:', promise, 'reason:', reason);
  logToFile('FATAL', msg);
  if (shouldWriteToConsole) {
    originalConsoleError(msg);
  }
  process.exit(1);
});

console.log('Logging initialized. Logs will be saved to:', LOG_FILE_PATH);
console.log('Data files will be stored in:', DATA_DIR);

// --- Data file paths ---
const PATIENTS_DATA_FILE = path.join(DATA_DIR, 'patients.json');
const ADMINS_FILE = path.join(DATA_DIR, 'admins.json');
const DOCTORS_FILE = path.join(DATA_DIR, 'doctors.json');
const CENTER_FILE = path.join(DATA_DIR, 'center.json');

// --- HTML file constants ---
const STARTUP_FILE = 'StartUp.html';
const LOGIN_FILE = 'login.html';
const INDEX_FILE = 'index.html';

// --- Encryption config ---
const ENCRYPTION_KEY = process.env.APP_ENCRYPTION_KEY;
const IV_KEY = process.env.APP_IV_KEY;
const IV_BUFFER = Buffer.from(IV_KEY, 'hex');
const KEY_BUFFER = Buffer.from(ENCRYPTION_KEY, 'hex');

// --- Session setup ---
app.use(session({
  name: 'mc.sid',
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, rolling: true, maxAge: 1000 * 60 * 60 * 8 }
}));
const csrf = require('csurf');
const csrfProtection = csrf({
  cookie: false
});

app.set('trust proxy', 1);

// --- Encryption helpers ---
function encrypt(text) {
  if (!text || typeof text !== 'string') return text;
  try {
    const cipher = crypto.createCipheriv(ALGORITHM, KEY_BUFFER, IV_BUFFER);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
  } catch (e) {
    console.error("Encryption failed:", e);
    return text;
  }
}
function decrypt(text) {
  if (!text || typeof text !== 'string' || text.length === 0) return text;
  try {
    if (!/^[0-9a-fA-F]+$/.test(text) || text.length % 2 !== 0) return text;
    const decipher = crypto.createDecipheriv(ALGORITHM, KEY_BUFFER, IV_BUFFER);
    let decrypted = decipher.update(text, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (e) {
    console.warn("Decryption failed:", e.message);
    return text;
  }
}

// --- Fallback helpers for data import ---
function fallbackString(v) {
  return typeof v === "string" && v.trim() ? v : "offline";
}

function fallbackDate(v) {
  return v ? new Date(v) : new Date();
}

function fallbackBool(v) {
  return typeof v === "boolean" ? v : false;
}


// --- Utility helpers ---
function processPatient(patient, action) {
  const fn = action === 'encrypt' ? encrypt : decrypt;
  patient.fullName = fn(patient.fullName);
  patient.idNumber = fn(patient.idNumber);
  if (patient.visits && Array.isArray(patient.visits)) {
    patient.visits = patient.visits.map(visit => ({
      ...visit,
      // NEW FORMAT
        doctor: visit.doctor,
        center: visit.center,
        nurseNote: visit.nurseNote,
        servesTyp: visit.servesTyp,
        diagnosis: fn(visit.diagnosis),
        medications: fn(visit.medications),

    }));
  }
  return patient;
}

const readJsonFile = async (filePath) => {
  try {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    const data = await fs.readFile(filePath, 'utf8');
    if (!data.trim()) return [];
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT' || error.name === 'SyntaxError') return [];
    console.error(`Error reading JSON file ${filePath}:`, error);
    throw error;
  }
};

const writeJsonFile = async (filePath, data) => {
  try {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
  } catch (error) {
    console.error(`Error writing JSON file ${filePath}:`, error);
    throw error;
  }
};

// --- Middleware ---
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// ✅ Serve JS properly when bundled
app.get('/script.js', (req, res) => serveBundledFile(res, 'script.js', 'application/javascript'));
app.get('/visits.js', (req, res) => serveBundledFile(res, 'visits.js', 'application/javascript'));

// ✅ Serve static folder if it exists
app.use('/static', express.static(path.join(__dirname, 'static')));

app.get('/boot/admin.js',
  requireRole('admin'),
  (req, res) => serveBundledFile(res, 'boot/admin.js', 'application/javascript')
);

app.get('/boot/doctor.js',
  requireRole('doctor'),
  (req, res) => serveBundledFile(res, 'boot/doctor.js', 'application/javascript')
);
app.get('/boot/nurse.js',
  requireRole('nurse'),
  (req, res) => serveBundledFile(res, 'boot/nurse.js', 'application/javascript')
);
app.get('/boot/pharmacist.js',
  requireRole('pharmacist'),
  (req, res) => serveBundledFile(res, 'boot/pharmacist.js', 'application/javascript')
);
app.get('/boot/writer.js',
  requireRole('writer'),
  (req, res) => serveBundledFile(res, 'boot/writer.js', 'application/javascript')
);

const rateLimit = require('express-rate-limit');
// here is where the rate limiter is !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!

const ipLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 دقيقة
  max: 100,                // 100 محاولة لكل IP
  standardHeaders: true,
  legacyHeaders: false,
});

const loginLimiter = rateLimit({
  windowMs: 60 * 1000, // دقيقة واحدة
  max: 10,             // 10 محاولات فقط
  keyGenerator: (req) => {
    const ipKey = rateLimit.ipKeyGenerator(req); // ✅ REQUIRED
    const username = req.body?.username || 'unknown';
    return `${ipKey}-${username}`;
  },
  handler: (req, res) => {
    auditLog(req, {
      action: 'RATE_LIMIT_BLOCK',
      reason: 'LOGIN_BRUTE_FORCE',
      ip: req.ip,
      username: req.body?.username
    });

    res.status(429).json({
      error: 'too_many_attempts',
      message: 'تم تجاوز عدد محاولات تسجيل الدخول. انتظر دقيقة ثم حاول مرة أخرى.'
    });
  }
});

const usernameLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 دقيقة
  max: 10,                 // 10 محاولات
  keyGenerator: (req) => {
    const ipKey = rateLimit.ipKeyGenerator(req); // ✅ REQUIRED
    const username = req.body?.username || 'unknown';
    return `${ipKey}-${username}`;
  },
  handler: (req, res) => {
    auditLog(req, {
      action: 'USERNAME_TEMP_LOCK',
      ip: req.ip,
      username: req.body?.username
    });

    res.status(429).json({
      error: 'username_locked',
      message: 'تم إيقاف هذا المستخدم مؤقتًا بسبب محاولات متكررة.'
    });
  }
});

const uploadLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 20
});

app.use((req, res, next) => {
  if (req.method === 'GET' || req.path === '/login' || req.path ==='/api/csrf-token' ) {
    return next();
  }

  return csrfProtection(req, res, next);
});

// --- Routes ---
app.get('/login', (req, res) => {
  if (req.session && req.session.user) return res.redirect('/');
  serveBundledFile(res, LOGIN_FILE);
});

app.post('/login',ipLimiter,usernameLimiter,loginLimiter, async (req, res) => {
  const { username, password } = req.body;

  try {
    // 1) جلب المستخدم من قاعدة البيانات
    const user = await prisma.user.findFirst({
      where: { userName: username ,isActive: true}
    });

    if (!user) {
      auditLog(req, {action: 'LOGIN_FAIL',reason: 'USER_NOT_FOUND',username});
      return res.status(401).json({
        success: false,
        message: "اسم المستخدم أو كلمة المرور غير صحيحة"
      });
    }

    // 2) مقارنة كلمة المرور (bcrypt)
    const isMatch = await bcrypt.compare(password, user.passWord);// password > user input ,user.passWord enc in DB
    if (!isMatch) {
        auditLog(req, {action: 'LOGIN_FAIL',reason: 'WRONG_PASSWORD',username});
        return res.status(401).json({
            success: false,
            message: "اسم المستخدم أو كلمة المرور غير صحيحة"
      });
    }

    // 3) إنشاء الجلسة
    req.session.user = {
      id: user.idUser,
      username: user.userName,
      role: user.role
    };
    auditLog(req, {action: 'LOGIN_SUCCESS'});

    return res.json({ success: true });

  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ success: false });
  }
});



app.post('/logout', (req, res) => {
  const userSnapshot = req.session?.user;
  req.session.destroy(err => {
    if (err) return res.status(500).json({ success: false });
    res.clearCookie('mc.sid');
    res.json({ success: true });
    auditLog(req, {action: 'LOGOUT',user: userSnapshot});
  });
});
app.get('/session-info', async (req, res) => {
    if (!req.session.user) {
        return res.json({ role: null });
    }
    try {
        const user = await prisma.user.findUnique({
            where: { idUser: req.session.user.id },
            include: { center: true }
        });

        if (!user) {
            req.session.destroy(); // Clean up invalid session
            return res.status(404).json({ role: null, message: "User not found." });
        }

        // Return a structured object with user and center details
        const sessionData = {
            id: user.idUser,
            username: user.userName,
            role: user.role,
            center: user.center ? { id: user.center.idCenter, name: user.center.name } : null
        };

        res.json(sessionData);

    } catch (error) {
        console.error('Failed to get session info:', error);
        res.status(500).json({ message: 'Failed to retrieve session data.' });
    }
});
app.get('/api/csrf-token',requireRole('writer','doctor','nurse','admin','pharmacist'),csrfProtection, (req, res) => {
  res.json({ csrfToken: req.csrfToken() });
});


function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.session?.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!allowedRoles.includes(req.session.user.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    next();
  };
}


// =================================================================
// --- USER & CENTER SETUP API (Easy to find as requested) ---
// =================================================================

// Endpoint to create a new medical center
app.post('/api/setup/center',requireRole('admin'), async (req, res) => {
  const { center_name } = req.body;
  if (!center_name) {
    return res.status(400).json({ message: 'Center name is required' });
  }
  try {
    const existingCenter = await prisma.center.findFirst({ where: { name: center_name } });
    if (existingCenter) {
      return res.status(409).json({ message: 'Center name already exists' });
    }
    const newCenter = await prisma.center.create({
      data: { name: center_name },
    });
    res.status(201).json({ message: `Center '${newCenter.name}' created successfully!`, center: newCenter });
  } catch (error) {
    console.error('Error creating center:', error);
    res.status(500).json({ message: 'Error saving center details' });
  }
});

// Endpoint to create a new user
app.post('/api/setup/user', requireRole('admin'), async (req, res) => {
  const { username, password, role, centerName } = req.body;
  const name = sanitizeText(req.body.name);
  if (!name || !username || !password || !role || !centerName) {
    return res.status(400).json({ message: 'All fields are required: name, username, password, role, centerName' });
  }

  try {
    // Check if center exists
    const center = await prisma.center.findFirst({ where: { name: centerName } });
    if (!center) {
      return res.status(404).json({ message: `Center '${centerName}' not found.` });
    }

    // Check if username is already taken
    const existingUser = await prisma.user.findFirst({ where: { userName: username } });
    if (existingUser) {
        return res.status(409).json({ message: 'Username already exists' });
    }

    // Hash password and create user
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await prisma.user.create({
      data: {
        name: name,
        userName: username,
        passWord: hashedPassword,
        role: role,
        idCenter: center.idCenter,
      },
    });

    res.status(201).json({ message: `User '${newUser.name}' created successfully!`, user: { id: newUser.idUser, name: newUser.name, role: newUser.role } });
  } catch (err) {
    console.error('Error adding user:', err);
    res.status(500).json({ message: 'An error occurred while creating the user' });
  }
});

// =================================================================
// --- END OF SETUP API ---
// =================================================================


// --- (REMOVED) Patients API ---
// NOTE: The GET /api/patients and POST /api/patients endpoints have been removed.
// They were a performance bottleneck, as they loaded the entire database into the client.
// New, specific endpoints have been created to replace this functionality.


// --- Serve Frontend ---
app.get('/StartUp.html', requireRole('admin'), (req, res) => {
  serveBundledFile(res, STARTUP_FILE);
});

app.get('/', async (req, res) => {
  if (req.session && req.session.user) {
    serveBundledFile(res, INDEX_FILE);
  } else {
    res.redirect('/login');
  }
});

app.get('/api/doctors', requireRole('writer','doctor','nurse','admin'), async (req, res) => {
    try {
        const doctors = await readJsonFile(DOCTORS_FILE);
        const names = doctors.map(d => d.name);
        res.json(names);
    } catch (error) {
        res.status(500).json({ message: 'Error reading doctors' });
    }
});

app.get('/api/users/doctors',  requireRole('writer'), async (req, res) => {
    try {
        const doctors = await prisma.user.findMany({
            where: { role: 'doctor' , isActive: true },
            select: { idUser: true, name: true, idCenter: true },
            orderBy: { name: 'asc' }
        });
        res.json(doctors);
    } catch (error) {
        console.error('Error fetching doctors:', error);
        res.status(500).json({ message: 'Failed to fetch doctors list' });
    }
});
app.get('/api/center',requireRole('writer','doctor','nurse','pharmacist','admin'), async (req, res) => {
    try {
        const center = await readJsonFile(CENTER_FILE);

        const name = center.name;

        res.json({ name });
    } catch (error) {
        res.status(500).json({ message: 'Error reading center file' });
    }
});

// =================================================================
// --- ADMIN-SPECIFIC API Endpoints ---
// =================================================================

// NEW: Endpoint to get initial dashboard statistics for the admin panel.
app.get('/api/statistics/initial', requireRole('admin'), async (req, res) => {
    try {
        const totalPatients = await prisma.patients.count();
        const totalVisits = await prisma.visits.count();
        const femalePatients = await prisma.patients.count({ where: { gender: 'انثى' } });
        const pregnantPatients = await prisma.patients.count({ where: { isPregnant: true } });
        const disabledPatients = await prisma.patients.count({ where: { hasDisability: true } });

        res.json({
            totalPatients,
            totalVisits,
            femalePatients,
            pregnantPatients,
            disabledPatients,
        });
    } catch (error) {
        console.error('Error fetching initial statistics:', error);
        res.status(500).json({ message: 'Error fetching statistics' });
    }
});

app.get('/api/statistics/new-patients-monthly', requireRole('admin'), async (req, res) => {
    try {
        const { year, month } = req.query;

        if (!year || !month) {
            return res.status(400).json({ message: 'Year and month are required.' });
        }

        const y = parseInt(year);
        if (isNaN(y)) {
            return res.status(400).json({ message: 'Invalid year.' });
        }

        // Convert "July" → 7
        const monthNumber = new Date(`${month} 1, 2000`).getMonth() + 1;
        if (isNaN(monthNumber)) {
            return res.status(400).json({ message: 'Invalid month name.' });
        }

        const patients = await prisma.$queryRaw`
            SELECT p.*
            FROM "Patients" p
            JOIN "Visits" v ON v."idPatient" = p."idPatient"
            GROUP BY p."idPatient"
            HAVING
              EXTRACT(YEAR FROM MIN(v."dateOfVisit")) = ${y}
              AND EXTRACT(MONTH FROM MIN(v."dateOfVisit")) = ${monthNumber}
        `;

        res.json({ patients });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error fetching patients.' });
    }
});

// NEW: Endpoint to get all unique center names for the admin panel filters.
app.get('/api/centers/all', requireRole('admin'), async (req, res) => {
    try {
        const centers = await prisma.center.findMany({
            select: { idCenter: true, name: true },
            distinct: ['name']
        });
        res.json(centers);
    } catch (error) {
        console.error('Error fetching centers:', error);
        res.status(500).json({ message: 'Error fetching centers' });
    }
});

app.post('/api/import/patients', requireRole('admin'), upload.single('file'), async (req, res) => {
    const { centerId } = req.body;
    const file = req.file;

    if (!file) {
        return res.status(400).json({ message: 'No file uploaded.' });
    }
    if (!centerId) {
        return res.status(400).json({ message: 'No center selected.' });
    }

    try {
        const raw = file.buffer.toString('utf8');
        const patients = JSON.parse(raw);
        let addedCount = 0;
        let existingCount = 0;
        let visitCount = 0;

        for (const rawPatient of patients) {
            // Per user clarification: idNumber in JSON is already encrypted. Use as-is.
            const encryptedIdNumber = fallbackString(rawPatient.idNumber);
            if (!encryptedIdNumber || encryptedIdNumber === 'offline') continue;

            let patient = await prisma.patients.findUnique({
                where: { ID: encryptedIdNumber },
            });

            if (!patient) {
                // All sensitive fields from JSON are already encrypted. Use as-is.
                patient = await prisma.patients.create({
                    data: {
                        ID: encryptedIdNumber, // Use the already encrypted ID
                        fullName: fallbackString(rawPatient.fullName), // Use as-is
                        dob: fallbackDate(rawPatient.dob),
                        gender: fallbackString(rawPatient.gender),
                        isPregnant: fallbackBool(rawPatient.isPregnant),
                        phoneNumber: fallbackString(rawPatient.phoneNumber),
                        maritalStatus: fallbackString(rawPatient.maritalStatus),
                        hasDisability: fallbackBool(rawPatient.hasDisability),
                        disabilityType: fallbackString(rawPatient.disabilityType),
                    },
                });
                addedCount++;
            } else {
                existingCount++;
            }

            for (const v of rawPatient.visits ?? []) {
                const visitId = fallbackString(v.visitId);
                if (!visitId || visitId === 'offline') continue;

                const exists = await prisma.visits.findUnique({
                    where: { idVisit: visitId },
                });

                if (exists) {
                    continue;
                }

                await prisma.visits.create({
                    data: {
                        idVisit: visitId,
                        idPatient: patient.idPatient,
                        dateOfVisit: fallbackDate(v.date),
                        serverType: fallbackString(v.servesTyp),
                        idUser: 1, // Default user, as in original script
                        center: parseInt(centerId),
                    },
                });
                visitCount++;

                await prisma.doctorVisit.create({
                    data: {
                        idVisit: visitId,
                        idUser: 1, // Default user
                        diagnosis: fallbackString(v.diagnosis), // Use as-is
                        medications: fallbackString(v.medications), // Use as-is
                        needFurtherTest: false,
                        isContagious: false,
                    },
                });

                await prisma.nurseVisit.create({
                    data: {
                        idVisit: visitId,
                        idUser: 1, // Default user
                        nurseNote: fallbackString(v.nurseNote), // This field is plaintext
                    },
                });

                await prisma.pharmacyDispense.create({
                    data: {
                        quantityDispensed: 1,
                        visit: { connect: { idVisit: visitId } },
                        user: { connect: { idUser: 1 } },
                        medicine: { connect: { idMedicine: 1 } }
                    }
                });
            }
        }

        const message = `Import successful: ${addedCount} new patients, ${existingCount} existing patients, and ${visitCount} new visits added.`;
        auditLog(req, { action: 'IMPORT_PATIENTS', status: 'SUCCESS', details: message });
        res.json({ success: true, message });

    } catch (error) {
        console.error('Import error:', error);
        auditLog(req, { action: 'IMPORT_PATIENTS', status: 'FAIL', details: error.message });
        res.status(500).json({ message: 'Error processing file.', error: error.message });
    }
});


// NEW: Endpoint for the admin panel to get the most recent visits across all centers.
app.get('/api/visits/recent-admin', requireRole('admin'), async (req, res) => {
    try {
        const recentVisits = await prisma.visits.findMany({
            take: 10,
            orderBy: { dateOfVisit: 'desc' },
            include: {
                patient: {
                    select: { fullName: true }
                },
                doctorVisit: {
                    select: { diagnosis: true }
                }
            }
        });

        const formattedVisits = recentVisits.map(v => ({
            patientName: decrypt(v.patient.fullName),
            diagnosis: v.doctorVisit ? decrypt(v.doctorVisit.diagnosis) : '',
            date: v.dateOfVisit,
        }));

        res.json(formattedVisits);
    } catch (error) {
        console.error("Error fetching recent visits for admin:", error);
        res.status(500).json({ message: "Failed to fetch recent visits." });
    }
});

// =================================================================
// --- WRITER UI API Endpoints ---
// =================================================================

/**
 * API to get the most recent visits to display in the writer UI.
 */
app.get('/api/visits/recent', requireRole('writer'), async (req, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { idUser: req.session.user.id },
            select: { idCenter: true }
        });

        if (!user || !user.idCenter) {
            return res.status(403).json({ message: "User is not associated with a center." });
        }

        const recentVisits = await prisma.visits.findMany({
            where: {
                centerOwner: {idCenter: user.idCenter},
                pharmacy: {
                    none: {}
                }
            },
            take: 50, // Limit to the last 50 visits
            orderBy: { dateOfVisit: 'desc' },
            include: {
                patient: { // Include patient data to get more details
                    select: { fullName: true, idPatient: true, ID: true, phoneNumber: true }
                }
            }
        });

        const formattedVisits = recentVisits.map(v => ({
            visitId: v.idVisit,
            date: v.dateOfVisit,
            patientId: v.patient.idPatient,
            patientName: decrypt(v.patient.fullName),
            patientIdNumber: decrypt(v.patient.ID),
            patientPhoneNumber: v.patient.phoneNumber, // Phone number is not encrypted
        }));

        res.json(formattedVisits);
    } catch (error) {
        console.error("Error fetching recent visits:", error);
        res.status(500).json({ message: "Failed to fetch recent visits." });
    }
});

/**
 * API to delete a visit and all its related data (doctor, nurse, pharmacy).
 */
app.delete('/api/visits/:visitId', requireRole('writer','nurse','pharmacist'), async (req, res) => {
    const { visitId } = req.params;
    try {
        // Use a transaction to ensure all related data is deleted
        await prisma.$transaction(async (tx) => {
            await tx.doctorVisit.deleteMany({ where: { idVisit: visitId } });
            await tx.nurseVisit.deleteMany({ where: { idVisit: visitId } });
            await tx.pharmacyDispense.deleteMany({ where: { idVisit: visitId } });
            await tx.visits.delete({ where: { idVisit: visitId } });
        });
        auditLog(req, {action: 'DELETE_VISIT',visitId});
        res.json({ success: true, message: "Visit deleted successfully." });
    } catch (error) {
        console.error(`Failed to delete visit ${visitId}:`, error);
        res.status(500).json({ message: "Failed to delete the visit." });
    }
});


/**
 * API to find a single patient by their 9-digit ID number.
 */
app.get('/api/patient/by-id/:idNumber',  requireRole('writer'), async (req, res) => {
    const { idNumber } = req.params;
    if (!/^\d{9}$/.test(idNumber)) {
        return res.status(400).json({ message: "Invalid ID number format." });
    }

    try {
        const encryptedId = encrypt(idNumber);
        const patient = await prisma.patients.findUnique({
            where: { ID: encryptedId }
        });

        if (!patient) {
            return res.status(404).json({ message: "Patient not found." });
        }

        // Decrypt the data before sending it to the client
        const decryptedPatient = {
            ...patient,
            fullName: decrypt(patient.fullName),
            ID: decrypt(patient.ID),
            // Ensure dob is in YYYY-MM-DD format
            dob: new Date(patient.dob).toISOString().split('T')[0]
        };

        res.json(decryptedPatient);

    } catch (error) {
        console.error("Error fetching patient by ID:", error);
        res.status(500).json({ message: "Error finding patient." });
    }
});

/**
 * API to register a new visit. It handles:
 * 1. Finding an existing patient or creating a new one.
 * 2. Updating the existing patient's data if it has changed.
 * 3. Creating a new visit record linked to the patient.
 */
app.post('/api/register-visit', requireRole('writer'), async (req, res) => {
    const { idNumber, dob, gender, phoneNumber, maritalStatus, isPregnant, hasDisability, disabilityType, doctorId } = req.body;
    const fullName = sanitizeText(req.body.fullName);
    const address = sanitizeText(req.body.address);
    const displacedAddress = sanitizeText(req.body.displacedAddress);

    if (!idNumber || !fullName || !dob || !gender || !doctorId) {
        return res.status(400).json({ message: "Missing required fields." });
    }

    try {
        const loggedInUser = await prisma.user.findUnique({
            where: { idUser: req.session.user.id },
        });

        if (!loggedInUser || !loggedInUser.idCenter) {
            return res.status(400).json({ message: "Could not determine the user's medical center." });
        }

        const encryptedIdNumber = encrypt(idNumber);
        let patient = await prisma.patients.findUnique({ where: { ID: encryptedIdNumber } });

        const patientData = {
            ID: encryptedIdNumber,
            fullName: encrypt(fullName),
            dob: new Date(dob),
            gender: gender,
            phoneNumber: phoneNumber || null,
            address: address || null,
            displacedAddress: displacedAddress || null,
            maritalStatus: maritalStatus || null,
            isPregnant: isPregnant || false,
            hasDisability: hasDisability || false,
            disabilityType: disabilityType || null,
        };

        if (patient) {
            // Patient exists, update their info
            patient = await prisma.patients.update({
                where: { idPatient: patient.idPatient },
                data: patientData
            });
            console.log(`Updated existing patient: ${idNumber}`);
        } else {
            // Patient does not exist, create a new one
            patient = await prisma.patients.create({
                data: patientData
            });
            console.log(`Created new patient: ${idNumber}`);
        }

        // Create the new visit, conditionally connecting the doctor
        const visitData = {
            idVisit: crypto.randomUUID(),
            dateOfVisit: new Date(),
            patient: { connect: { idPatient: patient.idPatient } },
            centerOwner: { connect: { idCenter: loggedInUser.idCenter } },
            serverType: 'General', // Set default value for required field
            idRate: null,
        };

        if (doctorId && doctorId !== 'no_doctor') {
            visitData.doctor = { connect: { idUser: parseInt(doctorId) } };
        }

        const newVisit = await prisma.visits.create({ data: visitData });
          auditLog(req, {action: 'CREATE_VISIT',visitId: newVisit.idVisit,patientId: patient.idPatient});

        console.log(`Created new visit ${newVisit.idVisit} for patient ${idNumber}`);
        res.status(201).json({ message: "Visit registered successfully.", visitId: newVisit.idVisit });

    } catch (error) {
        console.error("Failed to register visit:", error);
        res.status(500).json({ message: "An internal error occurred while registering the visit." });
    }
});


let lastPing = Date.now();
//قائمة الانتظار Dr
app.get('/api/doctor/waiting-visits',requireRole('doctor'), async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { idUser: req.session.user.id },
      select: { idCenter: true }
    });

    if (!user || !user.idCenter) {
      return res.status(403).json({ message: "User is not associated with a center." });
    }

    const doctorId = req.session.user.id;
    const visits = await prisma.visits.findMany({
      where: {
        idUser: doctorId,
        doctorVisit: null,
        centerOwner: {idCenter: user.idCenter},
        pharmacy: {
          none: {}
        }
      },
      include: {
        patient: true,
        nurseVisit: true
      },
      orderBy: { dateOfVisit: 'desc' }
    });

    const decryptedVisits = visits.map(v => {
      if (v.patient) {
        v.patient.fullName = decrypt(v.patient.fullName);
        v.patient.ID = decrypt(v.patient.ID);
      }
      return v;
    });

    res.json(decryptedVisits);
  } catch (err) {
    console.error('Doctor waiting visits error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});
//حفظ التشخيص في doctorVisit
app.post('/api/doctor/visit/:visitId', requireRole('doctor'), async (req, res) => {
  const { visitId } = req.params;
  const { needFurtherTest,isContagious } = req.body;
  const diagnosis = sanitizeText(req.body.diagnosis);
  const medications = sanitizeText(req.body.medications);
  const medicalStatus = sanitizeText(req.body.medicalStatus);

  await prisma.doctorVisit.create({
    data: {
      idVisit: visitId,
      idUser: req.session.user.id,
      diagnosis: encrypt(diagnosis),
      medications: encrypt(medications),
      needFurtherTest: Boolean(needFurtherTest),
      isContagious: Boolean(isContagious)
    }
  });
    auditLog(req, {action: 'DOCTOR_DIAGNOSIS',visitId});
    //   المريض المرتبط بالزيارة
    const visit = await prisma.visits.findUnique({
      where: { idVisit: visitId },
      select: { idPatient: true }
    });
    // 3️⃣ حدّث الحالة الطبية للمريض (هنا كان النقص)
    await prisma.patients.update({
    where: { idPatient: visit.idPatient },
    data: { medicalStatus }
});

  res.json({ success: true });
});

app.get('/api/medicines', requireRole('pharmacist'), async (req, res) => {
    try {
        const medicines = await prisma.medicine.findMany({
            orderBy: { name: 'asc' }
        });
        res.json(medicines);
    } catch (error) {
        console.error('Error fetching medicines:', error);
        res.status(500).json({ message: 'Failed to fetch medicines' });
    }
});

app.post('/api/medicines', requireRole('pharmacist'), async (req, res) => {
    const name = sanitizeText(req.body.name);
    const type = sanitizeText(req.body.type);
    if (!name || !type) {
        return res.status(400).json({ message: 'Medicine name and type are required' });
    }

    try {
        const newMedicine = await prisma.medicine.create({
            data: {
                name,
                type,
                amount: 0 // Default amount to zero as requested
            }
        });
        res.status(201).json(newMedicine);
    } catch (error) {
        console.error('Error creating medicine:', error);
        res.status(500).json({ message: 'Failed to create medicine' });
    }
});

//قائمة انتظار الصيدلية
app.get('/api/pharmacy/waiting-visits', requireRole('pharmacist'), async (req, res) => {

  try {
    const user = await prisma.user.findUnique({
      where: { idUser: req.session.user.id },
      select: { idCenter: true }
    });

    if (!user || !user.idCenter) {
      return res.status(403).json({ message: "User is not associated with a center." });
    }

    const visits = await prisma.visits.findMany({
      where: {
        doctorVisit: {
          isNot: null
        },
        pharmacy: {
          none: {}
        },
        centerOwner: {idCenter: user.idCenter},
      },
      include: {
        doctorVisit: true,
        patient: true
      },
      orderBy: { dateOfVisit: 'desc' }
    });

    const result = visits.map(v => {
      const decryptedPatient = processPatient(
        {
          fullName: v.patient.fullName,
          idNumber: v.patient.ID,
          visits: []
        },
        'decrypt'
      );

      return {
        idVisit: v.idVisit,
        doctorDiagnosis: decrypt(v.doctorVisit?.diagnosis || ''),
        doctorMedications: decrypt(v.doctorVisit?.medications || ''),
        patient: {
          fullName: decryptedPatient.fullName,
          ID: decryptedPatient.idNumber,      // ✅ الهوية
          gender: v.patient.gender,
          isPregnant: v.patient.isPregnant,
          age: calculateAgeFromDOB(v.patient.dob)
        }
      };
    });



    res.json(result);
  } catch (err) {
    console.error('Pharmacy waiting visits error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});



//حفظ الدواء المصروف
app.post('/api/pharmacy/visit/:visitId', requireRole('pharmacist'), async (req, res) => {
    const { visitId } = req.params;
    const { idMedicine, quantity, note } = req.body;

    if (!idMedicine || !quantity) {
        return res.status(400).json({ message: 'Medicine ID and quantity are required.' });
    }

    try {
        // Enforce that a prescription document must be uploaded before dispensing.
        const document = await prisma.visitDocument.findUnique({
            where: { idVisit: visitId },
        });

        if (!document) {
            return res.status(400).json({ message: 'الرجاء رفع صورة الروشتة أولا قبل صرف الدواء' });
        }

        // Prevent duplicate medicine dispense
        const existingDispense = await prisma.pharmacyDispense.findFirst({
            where: {
                idVisit: visitId,
                idMedicine: idMedicine,
            }
        });

        if (existingDispense) {
            console.log(`Attempted to dispense duplicate medicine ${idMedicine} for visit ${visitId}. Blocked.`);
            return res.status(409).json({ message: 'This medicine has already been dispensed for this visit.' });
        }

        await prisma.pharmacyDispense.create({
            data: {
                quantityDispensed: quantity,
                visit: {connect: { idVisit: visitId } },
                user: {connect: { idUser: req.session.user.id }},
                medicine: {connect: { idMedicine: idMedicine }}
                // The 'note' is not part of the 'PharmacyDispense' model in the provided schema.
                // If it needs to be stored, the schema should be updated.
                // For now, we will ignore it.
            }
        });
        auditLog(req, {action: 'PHARMACY_DISPENSE',visitId,medicineId: idMedicine,quantity});
        res.json({ success: true });
    } catch (error) {
        // Handle potential race condition if there's a unique constraint in the DB
        if (error.code === 'P2002') {
            console.log(`Blocked duplicate medicine dispense for visit ${visitId} via unique constraint.`);
            return res.status(409).json({ message: 'This medicine has already been dispensed for this visit.' });
        }
        console.error(`Failed to save dispense for visit ${visitId}:`, error);
        res.status(500).json({ message: 'Failed to save dispense information.' });
    }
});
// رفع الروشتة
app.post('/api/pharmacy/visit/:visitId/document',requireRole('pharmacist'), uploadLimiter, upload.single('file'),async (req, res) => {

    try {
      const { visitId } = req.params;
      const file = req.file;

      if (!file) {
        return res.status(400).json({ message: 'لم يتم رفع ملف' });
      }

      const allowed = ['image/jpeg', 'image/png', 'application/pdf'];
      if (!allowed.includes(file.mimetype)) {
        return res.status(400).json({ message: 'Invalid file type' });
      }



      //  منع التكرار
      const exists = await prisma.visitDocument.findUnique({
        where: { idVisit: visitId }
      });

      if (exists) {
        return res.status(409).json({
          message: 'تم رفع الروشتة مسبقًا'
        });
      }
      let processedBuffer = file.buffer;
      let finalMime = file.mimetype;
      // ======  ضغط الصورة  Image ======
      if (file.mimetype.startsWith('image/')) {
        processedBuffer = await sharp(file.buffer, { limitInputPixels: 20_000_000 })
          .rotate()
          .resize({ width: 1400 }) //حد أقصى  او 1200
          .jpeg({
            quality: 70,
            mozjpeg: false
          })
          .toBuffer();

        finalMime = 'image/jpeg';
      }
      const originalKB  = Math.round(file.buffer.length / 1024);
      const finalKB     = Math.round(processedBuffer.length / 1024);

      console.log('Original size:', originalKB, 'KB');
      console.log('Compressed size:', finalKB, 'KB');



      //  إنشاء IV
      const iv = crypto.randomBytes(16);

      //إنشاء cipher
      const cipher = crypto.createCipheriv(ALGORITHM,KEY_BUFFER,iv);

      //تشفير
      const encryptedData = Buffer.concat([
        cipher.update(processedBuffer),
        cipher.final()
      ]);


      await prisma.visitDocument.create({
        data: {
          idVisit: visitId,
          encryptedData: encryptedData, // الصورة المشفرة
          iv: iv,                       // IV
          mimeType: file.mimetype       // image/png | image/jpeg | pdf
        }
      });

      res.json({ success: true });

    } catch (err) {
      console.error('Upload prescription error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  }
);
// عرض الروشتة
app.get('/api/visits/:visitId/document/view', requireRole('admin','pharmacist'),async (req, res) => {
    const { visitId } = req.params;

    const doc = await prisma.visitDocument.findUnique({
      where: { idVisit: visitId }
    });

    if (!doc) return res.status(404).json({ message: 'لا توجد روشتة' });

    const decipher = crypto.createDecipheriv(
      ALGORITHM,
      KEY_BUFFER,
      doc.iv
    );

    const decrypted = Buffer.concat([
      decipher.update(doc.encryptedData),
      decipher.final()
    ]);

    res.setHeader('Content-Type', doc.mimeType);
    res.setHeader('Content-Disposition', 'inline');
    res.send(decrypted);
  }
);

//تنزيل الروشتة
app.get('/api/visits/:visitId/document/download',requireRole('admin'),async (req, res) => {

    const visit = await prisma.visits.findUnique({
      where: { idVisit: req.params.visitId },
      include: {
        patient: { select: { ID: true } },
        document: true
      }
    });

    if (!visit || !visit.document) return res.sendStatus(404);

    const doc = visit.document;

    // فك تشفير
    const patientIdNumber = decrypt(visit.patient.ID);
    const visitDate = visit.dateOfVisit.toISOString().slice(0, 10)

    // تحديد الامتداد حسب النوع
    let ext = 'bin';
    if (doc.mimeType === 'image/jpeg') ext = 'jpg';
    else if (doc.mimeType === 'image/png') ext = 'png';
    else if (doc.mimeType === 'application/pdf') ext = 'pdf';

    const decipher = crypto.createDecipheriv(
      ALGORITHM,
      KEY_BUFFER,
      doc.iv
    );

    const decrypted = Buffer.concat([
      decipher.update(doc.encryptedData),
      decipher.final()
    ]);

    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${patientIdNumber}|${visitDate}.${ext}"`
    );
    res.setHeader('Content-Type', doc.mimeType);
    res.send(decrypted);
  }
);




function calculateAgeFromDOB(dob) {
  if (!dob) return '—';

  const birth = new Date(dob);
  const today = new Date();

  let years = today.getFullYear() - birth.getFullYear();
  let months = today.getMonth() - birth.getMonth();

  if (today.getDate() < birth.getDate()) {
    months--;
  }

  if (months < 0) {
    years--;
    months += 12;
  }

  // أقل من سنة → شهور
  if (years < 1) {
    const totalMonths =
      (today.getFullYear() - birth.getFullYear()) * 12 +
      (today.getMonth() - birth.getMonth());

    return `${totalMonths} شهر`;
  }
  // سنة أو أكثر
  return `${years} سنة`;
}

// ===============================
// CSRF Error Handler (MANDATORY)
// ===============================
app.use((err, req, res, next) => {
  if (err.code === 'EBADCSRFTOKEN') {
    console.warn('CSRF blocked:', req.method, req.path);

    // لا نرمي exception
    // لا نوقف السيرفر
    return res.status(403).json({
      error: 'INVALID_CSRF_TOKEN',
      message: 'انتهت الجلسة أو الطلب غير صالح. يرجى إعادة تحميل الصفحة.'
    });
  }

  // أي خطأ آخر
  next(err);
});



// --- Start the server ---
app.listen(PORT, () => {
  const url = `http://localhost:${PORT}`;
  console.log(`Server running at ${url}`);

  console.log("Waiting for browser heartbeat...");

  // ---- Kill server if browser tab stops pinging ----
  setInterval(() => {
    const now = Date.now();

    // 20 seconds without pings → Browser tab closed
    /*if (now - lastPing > 11000) {
      console.log("Browser tab stopped pinging — shutting down...");
      process.exit(0);
    }*/
  }, 5000); // check every 5 seconds

  console.log('Press Ctrl + C to stop the server.');
});

app.get('/api/nurse/waiting-visits', requireRole('nurse'), async (req, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { idUser: req.session.user.id },
            select: { idCenter: true }
        });

        if (!user || !user.idCenter) {
            return res.status(403).json({ message: "User is not associated with a center." });
        }

        const visits = await prisma.visits.findMany({
            where: {
                nurseVisit: null, // لم يتم إدخال بيانات ممرضة بعد
                center: user.idCenter,
                pharmacy: {
                    none: {}
                }
            },
            orderBy: { dateOfVisit: 'desc' },
            include: {
                patient: {
                    select: { fullName: true, ID: true }
                }
            }
        });

        const formatted = visits.map(v => ({
            visitId: v.idVisit,
            date: v.dateOfVisit,
            patientName: decrypt(v.patient.fullName),
            patientIdNumber: decrypt(v.patient.ID)
        }));

        res.json(formatted);
    } catch (err) {
        console.error("Nurse waiting visits error:", err);
        res.status(500).json({ message: "Failed to load nurse visits" });
    }
});

/**
 * Save nurse note
 */
app.post('/api/visits/:visitId/nurse', requireRole('nurse'), async (req, res) => {
    const { visitId } = req.params;
    const nurseNote = sanitizeText(req.body.nurseNote);

    if (!nurseNote) {
        return res.status(400).json({ message: "Nurse note is required" });
    }

    try {
        auditLog(req, {action: 'NURSE_NOTE',visitId});
        await prisma.nurseVisit.create({
            data: {
                idVisit: visitId,
                idUser: req.session.user.id,
                nurseNote
            }
        });

        res.json({ success: true });
    } catch (err) {
        console.error("Save nurse note error:", err);
        res.status(500).json({ message: "Failed to save nurse data" });
    }
});


// =================================================================
// --- ADMIN REPORTS API ---
// =================================================================

/**
 * NEW: Backend-powered custom report generation for patients and visits.
 * This endpoint receives filter criteria from the admin UI,
 * queries the database using Prisma, and returns filtered/formatted data.
 */
app.post('/api/reports/custom', requireRole('admin'), async (req, res) => {
  try {
    const {
        reportType, period, day, month, dateFrom, dateTo,
        points, gender, ageFilter, pregnant, disability, medicalStatus
    } = req.body;

    // 1. Build patient-level `where` clause for Prisma
    const patientWhere = {};
    if (gender) {
        patientWhere.gender = gender === 'female' ? 'انثى' : 'ذكر';
    }

    const dobConditions = [];
    if (ageFilter) {
        const cutoffDate = new Date();
        cutoffDate.setFullYear(cutoffDate.getFullYear() - 18);
        if (ageFilter === 'lt18') {
            dobConditions.push({ dob: { gt: cutoffDate } });
        } else { // 'gte18'
            dobConditions.push({ dob: { lte: cutoffDate } });
        }
    }

    if (pregnant) {
        patientWhere.gender = 'انثى';
        patientWhere.isPregnant = pregnant === 'yes';
        // Ensure age is >= 18 for pregnancy filter, as per original client logic
        const cutoffDate = new Date();
        cutoffDate.setFullYear(cutoffDate.getFullYear() - 18);
        dobConditions.push({ dob: { lte: cutoffDate } });
    }

    if (dobConditions.length > 0) {
        patientWhere.AND = dobConditions;
    }

    if (disability) {
        patientWhere.hasDisability = disability === 'yes';
    }
    if (medicalStatus) {
        patientWhere.medicalStatus = medicalStatus;
    }

    // 2. Build visit-level `where` clause for Prisma
    const visitWhere = {};
    if (period === 'daily' && day) {
        visitWhere.dateOfVisit = {
            gte: new Date(`${day}T00:00:00.000Z`),
            lte: new Date(`${day}T23:59:59.999Z`),
        };
    } else if (period === 'monthly' && month) {
        const [y, m] = month.split('-').map(Number);
        visitWhere.dateOfVisit = {
            gte: new Date(Date.UTC(y, m - 1, 1)),
            lt: new Date(Date.UTC(y, m, 1)),
        };
    } else if (period === 'range' && dateFrom && dateTo) {
        visitWhere.dateOfVisit = {
            gte: new Date(`${dateFrom}T00:00:00.000Z`),
            lte: new Date(`${dateTo}T23:59:59.999Z`),
        };
    }

    if (points && points.length > 0) {
        visitWhere.centerOwner = { name: { in: points } };
    }

    // 3. Fetch patients with filtered visits
    const patients = await prisma.patients.findMany({
        where: patientWhere,
        include: {
            visits: {
                where: visitWhere,
                include: {
                    doctor: true,
                    centerOwner: true,
                    doctorVisit: true,
                    nurseVisit: true,
                    document: true,
                     pharmacy: {
                        include: { medicine: true }
                     }
                },
                orderBy: { dateOfVisit: 'desc' },
            },
        },
    });

    // 4. Post-filter to only include patients who have visits matching the criteria
    const patientsWithVisits = patients.filter(p => p.visits.length > 0);

    // 5. Map to the expected format and Decrypt data
    const decryptedPatients = patientsWithVisits.map(patient => {
        const mappedPatient = {
            id: patient.idPatient,
            idNumber: patient.ID,
            fullName: patient.fullName,
            dob: new Date(patient.dob).toLocaleDateString('en-CA'),
            gender: patient.gender,
            isPregnant: patient.isPregnant,
            phoneNumber: patient.phoneNumber,
            maritalStatus: patient.maritalStatus,
            medicalStatus: patient.medicalStatus,
            hasDisability: patient.hasDisability,
            disabilityType: patient.disabilityType,
            visits: patient.visits.map(v => ({
                visitId: v.idVisit,
                date: v.dateOfVisit.toISOString(),
                doctor: v.doctor ? v.doctor.name : 'N/A',
                center: v.centerOwner ? v.centerOwner.name : 'N/A',
                nurseNote: v.nurseVisit ? (v.nurseVisit.nurseNote || '') : '',
                servesTyp: v.serverType,
                diagnosis: v.doctorVisit ? (v.doctorVisit.diagnosis || '') : '',
                medications: v.doctorVisit ? (v.doctorVisit.medications || '') : '',
                medicineName: v.pharmacy?.map(d => d.medicine.name).join(', ') || null,
                hasDocument: !!v.document,
                document: v.document
            }))
        };
        return processPatient(mappedPatient, 'decrypt');
    });

    // 6. Calculate statistics
    const stats = {
        totalPatients: decryptedPatients.length,
        totalVisits: decryptedPatients.reduce((acc, p) => acc + p.visits.length, 0),
        femalePatients: decryptedPatients.filter(p => p.gender === 'انثى').length,
        pregnantPatients: decryptedPatients.filter(p => p.isPregnant).length,
        disabledPatients: decryptedPatients.filter(p => p.hasDisability).length,
    };

    // 7. Format response based on reportType
    let reportData;
    if (reportType === 'patient') {
        reportData = decryptedPatients.map(p => ({
            fullName: p.fullName,
            idNumber: p.idNumber,
            gender: p.gender,
            dob: p.dob,
            age: calculateAgeFromDOB(p.dob),
            hasDisability: p.hasDisability,
            disabilityType: p.disabilityType,
            phoneNumber: p.phoneNumber,
            isPregnant: p.isPregnant,
            visitsInPeriod: p.visits.length,
        }));
    } else if (reportType === 'visit') {
        reportData = [];
        decryptedPatients.forEach(p => {
            p.visits.forEach(v => {
                reportData.push({
                    visitId: v.visitId,
                    patientName: p.fullName,
                    patientIdNumber: p.idNumber,
                    date: v.date,
                    nurseNote: v.nurseNote,
                    diagnosis: v.diagnosis,
                    doctor: v.doctor,
                    center: v.center,
                    servesTyp: v.servesTyp,
                    medicineName: v.medicineName || null,
                    hasDocument: v.hasDocument,
                    documentMimeType: v.document?.mimeType || null
                });
            });
        });
    } else {
         return res.status(400).json({ message: 'Invalid report type' });
    }
    
    res.json({ stats, reportData });

  } catch (error) {
      console.error('Custom report error:', error);
      res.status(500).json({ message: 'Error generating custom report' });
  }
});


app.post(
  '/api/reports/medicines',
  requireRole('pharmacist', 'admin'),
  async (req, res) => {
    try {
      const { period, day, month, dateFrom, dateTo, centers } = req.body;
      const where = {};

      if (period === 'daily' && day) {
        // الفلترة اليومية
        const from = new Date(`${day}T00:00:00.000Z`);
        const to   = new Date(`${day}T23:59:59.999Z`);
        where.dispensedAt = { gte: from, lte: to };
      } else if (period === 'monthly' && month) {
        // الفلترة الشهرية
        const [y, m] = month.split('-').map(Number);
        const from = new Date(Date.UTC(y, m , 1, 0, 0, 0, 0));
        const to   = new Date(Date.UTC(y, m + 1, 1, 0, 0, 0, 0));
        where.dispensedAt = { gte: from, lt: to };
      } else if (period === 'range' && dateFrom && dateTo) {
        // الفلترة بين تاريخين
        const from = new Date(`${dateFrom}T00:00:00.000Z`);
        const to   = new Date(`${dateTo}T23:59:59.999Z`);
        where.dispensedAt = { gte: from, lte: to };
      }

      console.log('FINAL WHERE:', where);

      const dispenses = await prisma.pharmacyDispense.findMany({
        where,
        include: {
          medicine: true,
          visit: { include: { centerOwner: true } },
        },
      });

      // فلترة حسب المراكز (النقاط)
      const filteredByCenter = centers && centers.length
        ? dispenses.filter(d =>
            d.visit?.centerOwner && centers.includes(d.visit.centerOwner.name)
          )
        : dispenses;

      // تجميع البيانات حسب اسم الدواء
      const medicineMap = {};
      filteredByCenter.forEach(d => {
        const medName = d.medicine.name;
        if (!medicineMap[medName]) {
          medicineMap[medName] = { name: medName, dispenseCount: 0, totalQuantity: 0 };
        }
        medicineMap[medName].dispenseCount += 1;
        medicineMap[medName].totalQuantity += d.quantityDispensed;
      });

      res.json(Object.values(medicineMap));

    } catch (error) {
      console.error('Medicine report error:', error);
      res.status(500).json({ message: 'Error generating medicine report' });
    }
  }
);

app.get('/api/admin/users', requireRole('admin'), async (req, res) => {
  const users = await prisma.user.findMany({
    select: {
      idUser: true,
      name: true,
      userName: true,
      role: true,
      isActive: true,
      center: { select: { name: true } }
    },
    orderBy: { idUser: 'desc' }
  });

  res.json(users);
});

app.patch('/api/admin/users/:id/disable', requireRole('admin'), async (req, res) => {
  const idUser = Number(req.params.id);

  //  منع تعطيل نفسه
  if (req.session.user.id === idUser) {
    return res.status(400).json({
      message: ' !!! لا يمكنك تعطيل حسابك'
    });
  }
  await prisma.user.update({
    where: { idUser },
    data: { isActive: false }
  });

  auditLog(req, { action: 'DISABLE_USER', targetUserId: idUser });
  res.json({ success: true });
});

app.patch('/api/admin/users/:id/enable', requireRole('admin'), async (req, res) => {
  const idUser = Number(req.params.id);

  await prisma.user.update({
    where: { idUser },
    data: { isActive: true }
  });

  auditLog(req, { action: 'ENABLE_USER', targetUserId: idUser });
  res.json({ success: true });
});

// رفع الروشتة للممرضة
app.post('/api/nurse/visit/:visitId/document', requireRole('nurse'), uploadLimiter, upload.single('file'), async (req, res) => {
    try {
        const { visitId } = req.params;
        const file = req.file;

        if (!file) {
            return res.status(400).json({ message: 'لم يتم رفع ملف' });
        }

        const allowed = ['image/jpeg', 'image/png', 'application/pdf'];
        if (!allowed.includes(file.mimetype)) {
            return res.status(400).json({ message: 'نوع الملف غير مسموح' });
        }

        // التحقق من وجود الزيارة أولاً
        const visit = await prisma.visits.findUnique({
            where: { idVisit: visitId }
        });

        if (!visit) {
            return res.status(404).json({ message: 'الزيارة غير موجودة' });
        }

        // التحقق من وجود الروشتة مسبقاً
        const exists = await prisma.visitDocument.findUnique({
            where: { idVisit: visitId }
        });

        if (exists) {
            return res.status(409).json({
                message: 'تم رفع الروشتة مسبقًا لهذه الزيارة'
            });
        }

        // التحقق من أن المريض لم يذهب للصيدلية بعد
        const hasPharmacyDispense = await prisma.pharmacyDispense.findFirst({
            where: { idVisit: visitId }
        });

        if (hasPharmacyDispense) {
            return res.status(400).json({
                message: 'لا يمكن رفع الروشتة، المريض قد صرف الدواء بالفعل'
            });
        }

        // ضغط الصورة إذا كانت صورة
        let processedBuffer = file.buffer;
        let finalMime = file.mimetype;

        if (file.mimetype.startsWith('image/')) {
            try {
                processedBuffer = await sharp(file.buffer, { limitInputPixels: 20_000_000 })
                    .rotate()
                    .resize({ width: 1400 })
                    .jpeg({
                        quality: 70,
                        mozjpeg: false
                    })
                    .toBuffer();

                finalMime = 'image/jpeg';
            } catch (sharpError) {
                console.error('Sharp processing error:', sharpError);
                // إذا فشل الضغط، استخدم الملف الأصلي
                finalMime = file.mimetype;
            }
        }

        // التشفير
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv(ALGORITHM, KEY_BUFFER, iv);
        const encryptedData = Buffer.concat([
            cipher.update(processedBuffer),
            cipher.final()
        ]);

        // حفظ في قاعدة البيانات
        await prisma.visitDocument.create({
            data: {
                idVisit: visitId,
                encryptedData: encryptedData,
                iv: iv,
                mimeType: finalMime
                // لا يوجد حقل uploadedBy في الـ schema الحالي
            }
        });

        auditLog(req, {
            action: 'NURSE_PRESCRIPTION_UPLOAD',
            visitId,
            fileType: finalMime,
            uploadedBy: 'nurse'
        });

        // Automatically add a default prescription
        await prisma.pharmacyDispense.create({
            data: {
                idVisit: visitId,
                idMedicine: 1,
                quantityDispensed: 1,
                idUser: req.session.user.id
            }
        });
        
        res.json({ success: true, message: 'تم رفع الروشتة بنجاح' });

    } catch (err) {
        console.error('Nurse prescription upload error:', err);

        if (err.code === 'P2002') {
            return res.status(409).json({
                message: 'تم رفع الروشتة مسبقًا لهذه الزيارة'
            });
        }

        res.status(500).json({ error: 'خطأ في الخادم' });
    }
});

// التحقق مما إذا كان يمكن رفع الروشتة للممرضة
app.get('/api/nurse/visit/:visitId/can-upload', requireRole('nurse'), async (req, res) => {
    try {
        const { visitId } = req.params;

        // التحقق من وجود الزيارة
        const visit = await prisma.visits.findUnique({
            where: { idVisit: visitId },
            include: {
                doctorVisit: true,
                pharmacy: {
                    take: 1
                }
            }
        });

        if (!visit) {
            return res.status(404).json({
                canUpload: false,
                message: 'الزيارة غير موجودة'
            });
        }

        // التحقق من وجود بيانات الممرضة
        const hasNurseNote = await prisma.nurseVisit.findUnique({
            where: { idVisit: visitId }
        });

        if (!hasNurseNote) {
            return res.json({
                canUpload: false,
                message: 'يجب إدخال بيانات الممرضة أولاً'
            });
        }

        // التحقق من وجود تشخيص طبيب
        if (visit.doctorVisit) {
            return res.json({
                canUpload: false,
                message: 'المريض لديه تشخيص طبيب، يجب التوجه للصيدلية'
            });
        }

        // التحقق من صرف الدواء
        if (visit.pharmacy && visit.pharmacy.length > 0) {
            return res.json({
                canUpload: false,
                message: 'تم صرف الدواء بالفعل'
            });
        }

        // التحقق من وجود روشتة مرفوعة مسبقاً
        const existingDoc = await prisma.visitDocument.findUnique({
            where: { idVisit: visitId }
        });

        if (existingDoc) {
            return res.json({
                canUpload: false,
                message: 'تم رفع الروشتة مسبقاً'
            });
        }

        return res.json({
            canUpload: true,
            message: 'يمكن رفع الروشتة'
        });

    } catch (err) {
        console.error('Can upload check error:', err);
        res.status(500).json({
            canUpload: false,
            message: 'خطأ في التحقق'
        });
    }
});
