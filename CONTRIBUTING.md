# Contributing

Thanks for your interest in contributing to OpenClaw World!

## Development Setup

```bash
git clone https://github.com/ChenKuanSun/openclaw-world.git
cd openclaw-world
npm install
npm run dev
```

- Server runs on `http://127.0.0.1:18800`
- Frontend runs on `http://localhost:3000`

## Project Structure

```
server/          # Node.js game server (TypeScript)
src/             # Vite frontend (Three.js)
skills/          # OpenClaw skill definitions
  world-room/
    skill.json   # Machine-readable command schema
    SKILL.md     # LLM-friendly documentation
```

## Running Tests

```bash
npm test              # Run once
npm run test:watch    # Watch mode
npm run test:coverage # With coverage
```

## TypeScript

- Server: `tsconfig.server.json`
- Frontend: `tsconfig.json`

Check types without emitting:

```bash
npx tsc --noEmit -p tsconfig.server.json
npx tsc --noEmit
```

## Pull Requests

1. Fork the repo and create a feature branch
2. Make your changes
3. Run tests and type-check
4. Submit a PR with a clear description of the change

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
