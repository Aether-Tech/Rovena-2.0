# Rovena 2.0

Central de interação IA x Humano + gerenciamento de produtividade.

## 🚀 Tecnologias

- **Frontend**: React 19 + TypeScript + Vite
- **Desktop**: Electron
- **Backend**: Firebase Functions
- **Auth**: Firebase Authentication
- **Database**: Firestore
- **Pagamentos**: Stripe

## 📦 Instalação

```bash
# Clone o repositório
git clone https://github.com/1Verona/Rovena-2.0.git
cd rovena-2.0

# Instale as dependências
npm install

# Configure as variáveis de ambiente
cp .env.example .env
# Edite .env com suas credenciais Firebase
```

## 🔧 Desenvolvimento

```bash
# Modo desenvolvimento (browser)
npm run dev

# Modo desenvolvimento (Electron)
npm run electron:dev
```

## 🏗️ Build

```bash
# Build para produção
npm run build

# Build Electron (macOS/Windows)
npm run electron:build
```

## ⚙️ Firebase Functions

```bash
cd functions
npm install
npm run deploy
```

### Variáveis de Ambiente (Firebase Functions)

Configure no Firebase Console ou via CLI:

```bash
firebase functions:config:set stripe.secret_key="sk_xxx" openai.api_key="sk-xxx"
```

## 📱 Funcionalidades

- **Home**: Dashboard com tokens, estatísticas e to-dos
- **Chats**: Conversas com IA (em breve)
- **Images**: Geração de imagens (em breve)
- **Archives**: Histórico de interações (em breve)
- **Charts**: Visualização de dados (em breve)
- **Presentations**: Geração de slides (em breve)
- **Settings**: Configurações de conta e API

## 💰 Planos

- **Free**: 10.000 tokens/mês
- **Plus**: 3.000.000 tokens/mês

## 📄 Licença

MIT © Aether Tech
