const fs = require('fs');
const CryptoJS = require('crypto-js');

// === CONFIGURACION DE USUARIOS ===
const userCredentials = {
  "general": "123456"
};

// Generar una Master Key aleatoria
const masterKey = CryptoJS.lib.WordArray.random(32).toString();

// Leer el CRM real
const Html = fs.readFileSync('crm_original.html', 'utf8');

// Encriptar el  con la Master Key
const encrypted = CryptoJS.AES.encrypt(Html, masterKey).toString();

// Para cada usuario, encriptar la Master Key usando su contraseña
const usersData = {};
for (const [username, password] of Object.entries(userCredentials)) {
    usersData[username] = CryptoJS.AES.encrypt(masterKey, password).toString();
}

// Crear el index.html final
const htmlTemplate = `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Acceso - Samurai </title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700&display=swap" rel="stylesheet">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Inter', sans-serif; }
        body { 
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
            color: #fff;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            overflow: hidden;
            position: relative;
        }

        /* Animated background elements */
        .bg-shape {
            position: absolute;
            filter: blur(80px);
            opacity: 0.5;
            z-index: 0;
            animation: float 10s infinite ease-in-out alternate;
        }
        .shape1 { top: -10%; left: -10%; width: 400px; height: 400px; background: #e94560; border-radius: 50%; }
        .shape2 { bottom: -10%; right: -10%; width: 500px; height: 500px; background: #0f3460; border-radius: 50%; animation-delay: -5s; }

        @keyframes float {
            0% { transform: translate(0, 0) scale(1); }
            100% { transform: translate(30px, 50px) scale(1.1); }
        }
        
        .login-card {
            background: rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 20px;
            box-shadow: 0 25px 50px rgba(0,0,0,0.3);
            width: 100%;
            max-width: 420px;
            padding: 40px;
            z-index: 1;
            transform: translateY(20px);
            opacity: 0;
            animation: slideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        @keyframes slideUp {
            to { transform: translateY(0); opacity: 1; }
        }

        .login-header {
            text-align: center;
            margin-bottom: 30px;
        }

        .login-header h1 {
            font-size: 28px;
            font-weight: 700;
            margin-bottom: 8px;
            background: linear-gradient(to right, #fff, #a3bffa);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }

        .login-header p {
            font-size: 14px;
            color: rgba(255, 255, 255, 0.7);
        }

        .form-group {
            margin-bottom: 20px;
            position: relative;
        }

        .form-group label {
            display: block;
            font-weight: 600;
            margin-bottom: 8px;
            font-size: 13px;
            color: rgba(255, 255, 255, 0.9);
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .input-wrapper {
            position: relative;
        }

        .form-group input {
            width: 100%;
            padding: 14px 16px;
            background: rgba(0, 0, 0, 0.2);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 10px;
            font-size: 15px;
            color: #fff;
            transition: all 0.3s ease;
        }

        .form-group input::placeholder {
            color: rgba(255, 255, 255, 0.4);
        }

        .form-group input:focus {
            border-color: #e94560;
            outline: none;
            box-shadow: 0 0 0 4px rgba(233, 69, 96, 0.15);
            background: rgba(0, 0, 0, 0.3);
        }

        .toggle-password {
            position: absolute;
            right: 14px;
            top: 50%;
            transform: translateY(-50%);
            background: none;
            border: none;
            color: rgba(255, 255, 255, 0.6);
            cursor: pointer;
            font-size: 12px;
            font-weight: 600;
            text-transform: uppercase;
            transition: color 0.3s;
        }

        .toggle-password:hover {
            color: #fff;
        }

        .btn-login {
            background: linear-gradient(135deg, #e94560 0%, #c81d3e 100%);
            color: white;
            border: none;
            width: 100%;
            padding: 16px;
            border-radius: 10px;
            font-size: 16px;
            font-weight: 700;
            cursor: pointer;
            transition: all 0.3s ease;
            margin-top: 10px;
            box-shadow: 0 10px 20px rgba(233, 69, 96, 0.3);
        }

        .btn-login:hover {
            transform: translateY(-2px);
            box-shadow: 0 15px 25px rgba(233, 69, 96, 0.4);
        }
        
        .btn-login:active {
            transform: translateY(1px);
        }

        .error-message {
            color: #ff6b6b;
            background: rgba(255, 107, 107, 0.1);
            border: 1px solid rgba(255, 107, 107, 0.3);
            padding: 12px;
            border-radius: 8px;
            font-size: 14px;
            margin-bottom: 20px;
            text-align: center;
            display: none;
            animation: shake 0.5s;
        }

        @keyframes shake {
            0%, 100% { transform: translateX(0); }
            25% { transform: translateX(-5px); }
            75% { transform: translateX(5px); }
        }
    </style>
    <!-- Incluir CryptoJS -->
    <script src="https://cdnjs.cloudflare.com/ajax/libs/crypto-js/4.1.1/crypto-js.min.js"></script>
</head>
<body>
    <div class="bg-shape shape1"></div>
    <div class="bg-shape shape2"></div>
    
    <div class="login-card">
        <div class="login-header">
            <h1>Samurai & Bowie</h1>
            <p>Acceso Seguro al  Profesional</p>
        </div>
        <div class="login-body">
            <div id="error-box" class="error-message"></div>
            
            <form id="login-form">
                <div class="form-group">
                    <label for="username">Usuario</label>
                    <input type="text" id="username" placeholder="Ingresa tu usuario" required autocomplete="username">
                </div>
                <div class="form-group">
                    <label for="password">Contraseña</label>
                    <div class="input-wrapper">
                        <input type="password" id="password" placeholder="••••••••" required autocomplete="current-password">
                        <button type="button" class="toggle-password" id="toggle-pwd" tabindex="-1">Ver</button>
                    </div>
                </div>
                <button type="submit" id="submit-btn" class="btn-login">
                    <span id="btn-text">Iniciar Sesión</span>
                </button>
            </form>
        </div>
    </div>

    <script>
        // Toggle Password Visibility
        const pwdInput = document.getElementById('password');
        const togglePwdBtn = document.getElementById('toggle-pwd');

        togglePwdBtn.addEventListener('click', () => {
            if (pwdInput.type === 'password') {
                pwdInput.type = 'text';
                togglePwdBtn.textContent = 'Ocultar';
            } else {
                pwdInput.type = 'password';
                togglePwdBtn.textContent = 'Ver';
            }
        });

        // Datos encriptados generados automáticamente
        const ENCRYPTED_ = "${encrypted}";
        const USERS_DATA = ${JSON.stringify(usersData)};

        let errorTimeout = null;

        document.getElementById('login-form').addEventListener('submit', (e) => {
            e.preventDefault();

            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            const errorBox = document.getElementById('error-box');
            const submitBtn = document.getElementById('submit-btn');

            errorBox.style.display = 'none';
            clearTimeout(errorTimeout);

            submitBtn.textContent = 'Verificando...';
            submitBtn.disabled = true;

            setTimeout(() => {
                if (USERS_DATA[username]) {
                    try {
                        const bytesKey = CryptoJS.AES.decrypt(USERS_DATA[username], password);
                        const masterKeyDecrypted = bytesKey.toString(CryptoJS.enc.Utf8);

                        if (masterKeyDecrypted) {
                            const bytes = CryptoJS.AES.decrypt(ENCRYPTED_, masterKeyDecrypted);
                            const finalHtml = bytes.toString(CryptoJS.enc.Utf8);

                            if (finalHtml && finalHtml.includes('<html')) {
                                const exp = Date.now() + 24 * 60 * 60 * 1000; // 24 horas
                                localStorage.setItem('crm_auth', '1');
                                localStorage.setItem('crm_auth_exp', String(exp));
                                localStorage.setItem('crm_user', username);
                                window.location.href = 'crm.html';
                                return;
                            }
                        }
                    } catch (err) {
                        // Error de desencriptación — cae al mensaje de error
                    }
                }

                // Falló
                errorBox.textContent = "Usuario o contraseña incorrectos";
                errorBox.style.animation = 'none';
                errorBox.offsetHeight;
                errorBox.style.animation = 'shake 0.5s';
                errorBox.style.display = 'block';

                submitBtn.textContent = 'Iniciar Sesión';
                submitBtn.disabled = false;

                errorTimeout = setTimeout(() => { errorBox.style.display = 'none'; }, 4000);

                // Shake card — preservar estado visible antes de cancelar forwards
                const card = document.querySelector('.login-card');
                card.style.opacity = '1';
                card.style.transform = 'translateY(0)';
                card.style.animation = 'none';
                card.offsetHeight;
                card.style.animation = 'shake 0.5s';

            }, 400);
        });
    </script>
</body>
</html>`;

fs.writeFileSync('index.html', htmlTemplate);
console.log("¡index.html generado exitosamente con el  encriptado y nuevo diseño!");
