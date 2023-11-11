# Crypto Portfolio Tracker

This is a MVP app to track selected wallet addresses in selected networks.
User may add as much addresses it wants to track and select networks among the ones available: Ethereum, Polygon, Binance Smart Chain, Arbitrum, Optimism and Avalanche.
The app finds all ERC-20 Tokens owned by the specified addresses and gathers market price (if available) for them to value the entire portfolio.
Finally the user may snapshot its current position to compare later and track the changes on its portfolio (profit, loss, compositions, etc).
A "hide unworthy" checkbox was included to hide garbage airdrops user might receive.

### Improvements and Enhancements (not implemented)

- Display a timeline chart for portfolio value
- Include NFTs

## Hosted version

Open [https://crypto-portfolio-tracker-ly.s3.sa-east-1.amazonaws.com/index.html](https://crypto-portfolio-tracker-ly.s3.sa-east-1.amazonaws.com/index.html)

## Before running

You must install required packages before building the app:

```bash
npm i
```

You might have to change webpack config file to include resolve fallback instructions:

```javascript
resolve: {
      fallback: {
        "stream": false, // might also fallback with require.resolve("stream-browserify")
        "assert": false, // might also fallback with require.resolve("assert/")
      },
      ...
}
```

## Running

In the project directory, you can run:

```bash
npm start
```

Runs the app in the development mode.
Open [http://localhost:3000](http://localhost:3000) to visualize it.

## Questions

If you have any questions, please e-mail me [lyamamotorio@gmail.com](lyamamotorio@gmail.com)