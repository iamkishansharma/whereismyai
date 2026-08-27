# whereismyai

> Run open-source AI models locally on your mobile device.

**whereismyai** is an open-source mobile app that lets you download and run AI models directly on your device. The goal is to make local AI simple, accessible, and efficient without depending on cloud inference.

## ✨ Features

- 🤖 Runs open-source GGUF models fully on-device via llama.cpp
- 🖼️ Vision models — ask questions about a photo
- 🔒 Nothing leaves the phone; works with no network once a model is downloaded
- 📦 Curated model catalog plus Hugging Face search and downloads
- 💬 Multiple conversations, per-conversation model and system prompt
- ⚙️ Per-model generation settings
- 📱 iOS and Android

See **[FEATURES.md](FEATURES.md)** for the full list, including known limitations and
what's planned.

## 📸 Screenshots

<p align="center">
  <img src="docs/screenshots/home.png" width="250" />
  <img src="docs/screenshots/chat.png" width="250" />
  <img src="docs/screenshots/models.png" width="250" />
</p>

> Screenshots coming soon.

## 🚀 Getting Started

### Requirements

- Node.js
- Yarn
- React Native development environment
- Xcode for iOS
- Android Studio for Android

### Installation

Clone the repository:

```bash
git clone https://github.com/iamkishansharma/whereismyai.git
cd whereismyai
```

Install dependencies:

```bash
yarn install
```

Run on iOS:

```bash
yarn ios
```

Run on Android:

```bash
yarn android
```

## 🧠 Usage

1. Open **whereismyai** on your device.
2. Browse the available AI models.
3. Download a model.
4. Select the model and start chatting.
5. Run inference directly on your device.

> Model performance depends on your device hardware, model size, and quantization.

## 🤖 Model Support

whereismyai is built to support open-source models that are suitable for mobile devices.

Model support will expand over time as new runtimes and formats are added.

| Model       | Status         |
| ----------- | -------------- |
| More models | 🚧 Coming soon |

## 🗂️ Project structure

Organised by feature: everything a feature needs lives in one folder, and cross-feature
imports go through that folder's `index.ts`.

```
source/
  app/          root component, providers, database gate
  features/
    chat/       transcript, composer, chat store, prompt building
    models/     catalog, Hugging Face search, downloads, model store
    onboarding/ first-run carousel and starter model
    settings/   theme and app preferences
  core/         infrastructure with no feature knowledge
    llama/      native context lifecycle, context-window fitting
    db/         SQLite schema, drizzle migrations, chat repository
    attachments/ image picking and on-disk storage
    fs.ts       shared filesystem helpers
  shared/       ui/ theme/ utils/ — reusable, feature-agnostic
  navigation/   navigators, linking, route types
  types/        domain vocabulary (chat, model, theme)
```

Two rules keep this honest: `core/` and `shared/` never import from `features/`, and
store contracts live beside their store rather than in `types/`.

### Checks

`yarn verify` runs the whole gate — typecheck, lint (zero warnings), format check, tests.

```bash
yarn verify      # everything below, in order
yarn typecheck   # tsc --noEmit
yarn lint        # eslint, --max-warnings 0
yarn format      # prettier --write .
yarn test        # jest
```

## 🤝 Contributing

Contributions are welcome and appreciated.

1. Fork the repository and create a branch
2. Make your changes
3. Run `yarn verify` — it must pass before you open a PR
4. Commit, push, and open a Pull Request

For larger changes, consider opening an issue first so we can discuss the idea.

## 🐛 Issues

Found a bug or have a problem?

Please open an issue and include:

- Device and OS version
- Model being used
- Steps to reproduce
- Expected behavior
- Actual behavior
- Relevant logs or screenshots

## 📄 License

whereismyai is licensed under the **GNU General Public License v3.0 (GPLv3)**.

See the [LICENSE](LICENSE) file for the full license text.

## ⭐ Support

If you find **whereismyai** useful, consider giving the repository a ⭐ on GitHub.

Contributions, feedback, and ideas are always welcome.

---

<p align="center">
  Built with ❤️ for local and open-source AI.
</p>
