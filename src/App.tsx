import React from 'react';
import './app.scss';
import { Chart as ChartJS, ArcElement, Tooltip, ChartData } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import Moralis from 'moralis';
import { EvmChain, Erc20Value, Erc20Token } from '@moralisweb3/evm-utils';

// We are using Chart.js to display portfolio doughnut chart, register some features for the chart
ChartJS.register(ArcElement, Tooltip);

interface Wallet {
	address: string,
	chain: EvmChain,
}

interface SerializedNative {
	chainId: string,
	name?: string,
	symbol?: string,
	balance: number,
	price: number,
}

interface SerializedFT {
	chainId?: string,
	tokenAddress?: string,
	name?: string,
	symbol?: string,
	balance: number,
	price: number,
}

interface Snapshot {
	timestamp: number,
	natives: SerializedNative[],
	fts: SerializedFT[],
	portfolioValue: number,
}

// List of available networks
const CHAINS = [
	EvmChain.ETHEREUM,
	EvmChain.POLYGON,
	EvmChain.BSC,
	EvmChain.ARBITRUM,
	EvmChain.OPTIMISM,
	EvmChain.AVALANCHE,
];

// Price native for native tokens will come from wrapped ERC-20 tokens in Ethereum network
// List of wrapped ERC-20 token contracts addresses
const WRAPPED_CONTRACTS = [
	"0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // wETH
	"0x7c9f4C87d911613Fe9ca58b579f737911AAD2D43", // wMATIC
	"0x418D75f65a02b3D53B2418FB8E1fe493759c7605", // wBNB
	"0xB50721BCf8d664c30412Cfbc6cf7a15145234ad1", // ARB
	"", //
	"0x85f138bfEE4ef8e540890CFb48F620571d67Eda3", // wAVAX
];

// We will use localStorage to keep user data so that we ensure privacy
// Here we load all stored data: accounts (wallet addresses), chains (selected networks) and snapshots (portfolio saved in given timestamps)
const storedAccounts: string[] = JSON.parse(localStorage.getItem("accounts") || "[]");
const storedRawChains: string[] = JSON.parse(localStorage.getItem("chains") || "[\"0x1\"]");
const storedChains = CHAINS.filter(c => storedRawChains.some(stored => stored === c.hex));
const storedSnapshots: Snapshot[] = JSON.parse(localStorage.getItem("snapshots") || "[]");

function App() {

	// App state variables
	const [snapshots, setSnapshots] = React.useState<Snapshot[]>(storedSnapshots); // Portfolio snapshots
	const [selectedSnapshot, setSelectedSnapshot] = React.useState<number>(-1); // Selected portfolio snapshot index to display (-1 for current)
	const [accounts, setAccounts] = React.useState<string[]>(storedAccounts); // Accounts: app will retrieve all assets held by these accounts
	const [newAccount, setNewAccount] = React.useState<string>(""); // Input variable user enter to start tracking new account
	const [chains, setChains] = React.useState<EvmChain[]>(storedChains); // Selected chains: app will query data from this selected networks
	const [natives, setNatives] = React.useState<Map<string, number>>(new Map()); // List of native token balances owned by the accounts
	const [fts, setFTs] = React.useState<Erc20Value[]>([]); // List of ERC-20 token balances owned by the accounts (FT stands for fungible token)
	const [nativePrices, setNativePrices] = React.useState<Map<string, number>>(new Map()); // List of native token prices owned by the accounts
	const [prices, setPrices] = React.useState<Map<string, Map<string, number>>>(new Map()); // List of ERC-20 token prices owned by the accounts
	const [hideZeros, setHideZeros] = React.useState<boolean>(true); // Flag to hide unworthy tokens: do not display garbage airdrops

	const wallets = accounts.map(account => chains.map(chain => ({ address: account, chain } as Wallet))).flat(); // Cross accounts and selected networks to form a list of wallets (e.g: account X in network Y)

	// Request native token balance for each wallet in the list using Moralis
	const loadNatives = async () => {
		const newNatives: Map<string, number> = new Map();

		for(const wallet of wallets) {
			const response = await Moralis.EvmApi.balance.getNativeBalance({
				address: wallet.address,
				chain: wallet.chain,
			});

			newNatives.set(wallet.chain.hex, (newNatives.has(wallet.chain.hex) ? newNatives.get(wallet.chain.hex)! : 0) + Number(response.result.balance.value) / Math.pow(10, wallet.chain.currency?.decimals ?? 18));
		}

		setNatives(newNatives);
	}

	// Request ERC-20 token balance for each wallet in the list using Moralis
	const loadFTs = async () => {
		const newFTs: Erc20Value[] = [];

		for(const wallet of wallets) {
			const response = await Moralis.EvmApi.token.getWalletTokenBalances({
				address: wallet.address,
				chain: wallet.chain,
			});

			newFTs.push(...response.result);
		}

		setFTs(newFTs);
	}

	// Request price for native token (wrapped ERC-20 token actually) in the list using Moralis
	const loadNativePrices = async () => {
		const newNativePrices = new Map<string, number>();

		for(const chain of chains) {
			const tokenAddress = WRAPPED_CONTRACTS[CHAINS.indexOf(chain)];

			if(nativePrices.has(chain.hex)) continue;

			try {
				const response = await Moralis.EvmApi.token.getTokenPrice({
					address: tokenAddress,
					chain: EvmChain.ETHEREUM,
				});

				newNativePrices.set(chain.hex, response.result.usdPrice);
			} catch(e) {
				console.warn(e);
			}
		}

		setNativePrices(newNativePrices);
	}

	// Request price for ERC-20 token in the list using Moralis
	const loadPrices = async () => {
		const newPrices = new Map<string, Map<string, number>>();

		for(const token of fts) {
			const tokenAddress = token.token?.contractAddress.lowercase ?? "";
			const chain = token.token?.chain;

			const chainId = chain?.hex ?? "0x0";
			if(!newPrices.has(chainId)) {
				newPrices.set(chainId, new Map());
			}

			if(prices.has(chainId) && prices.get(chainId)?.has(tokenAddress)) {
				newPrices.get(chainId)?.set(tokenAddress, prices.get(chainId)!.get(tokenAddress)!);
				continue;
			}

			try {
				const response = await Moralis.EvmApi.token.getTokenPrice({
					address: tokenAddress,
					chain,
				});

				newPrices.get(chainId)!.set(tokenAddress, response.result.usdPrice);
			} catch(e) {
				console.warn(e);
			}
		}

		setPrices(newPrices);
	}

	// Loads native and ERC-20 tokens
	const loadAll = () => {
		loadNatives();
		loadFTs();
	}

	// Save changes in accounts (account added or removed)
	const storeAccounts = () => {
		localStorage.setItem("accounts", JSON.stringify(accounts));
	}

	// Save changes in chains (network selected/unselected)
	const storeChains = () => {
		localStorage.setItem("chains", JSON.stringify(chains.map(c => c.hex)));
	}

	// Configure react effects for loading tokens and prices and save changes on state variable changes
	React.useEffect(() => { loadNativePrices(); }, [natives]);
	React.useEffect(() => { loadPrices(); }, [fts]);
	React.useEffect(loadAll, [accounts, chains]);
	React.useEffect(storeAccounts, [accounts]);
	React.useEffect(storeChains, [chains]);

	// Change input account state variable
	const handleNewAccountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		setNewAccount(e.currentTarget.value);
		e.preventDefault();
	}

	// Add input account to the list
	const addAccount = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if(e.key === "Enter" && !accounts.some(a => a === newAccount)) {
			setAccounts([...accounts, newAccount]);
			setNewAccount("");
			e.preventDefault();
		}
	}

	// Remove account from the list
	const removeAccount = (account: string) => {
		return (e: React.MouseEvent<HTMLButtonElement>) => {
			if(accounts.some(a => a === account)) {
				setAccounts(accounts.filter(a => a !== account));
			}
			e.preventDefault();
		}
	}

	// Select/unselect chain
	const toggleChain = (chain: EvmChain) => {
		return (e: React.MouseEvent<HTMLDivElement>) => {
			let newChains;
			if(chains.some(c => c.hex === chain.hex)) {
				newChains = chains.filter(c => c.hex !== chain.hex);
			} else {
				newChains = [...chains, chain];
			}
			setChains(newChains);
			e.preventDefault();
		}
	}

	// Hide/unhide unworthy tokens
	const toggleHideZeros = (e: React.FormEvent<HTMLInputElement>) => {
		setHideZeros(old => !old);
		e.preventDefault();
	}

	// Auxiliary getter for native price
	const getNativePrice = (chainId: string) => {
		return nativePrices.get(chainId) ?? 0;
	}

	// Auxiliary getter for ERC-20 price
	const getPrice = (token: Erc20Token | null) => {
		return prices.get(token?.chain.hex ?? "0x-1")?.get(token?.contractAddress.lowercase ?? "") ?? 0;
	}

	// Auxiliary getter for ERC-20 balance
	const getAmount = (token: Erc20Value) => {
		return Number(token.amount) / Math.pow(10, token.decimals);
	}

	// Normalize amount for better human-readable display (1300 -> 1.3k, 5600000 -> 5.6M)
	const normalizeAmount = (amount: number) => {
		let i = 0;
		while(amount >= 1e3) {
			amount /= 1e3;
			i++;
		}

		return `${amount.toFixed(2)}${["", "k", "M", "B", "T", "q", "Q"][i] ?? "?"}`;
	}

	// Parse native token and ERC-20 token data (balances and prices) to chart data format
	const generateChartData = (): ChartData<"doughnut", number[], unknown> => {
		let portfolioValue = 0;

		// Use a Heap data structure to sort max portfolio item value
		const tokenHeap = new TokenHeap();

		// extract native token data
		for(const native of serializeNative(chains)) {
			const token = {
				symbol: native.symbol ?? "Unknown",
				value: native.balance * native.price,
			};
			tokenHeap.add(token);
			portfolioValue += token.value;
		}

		// extract ERC-20 token data
		for(const ft of fts) {
			const token = {
				symbol: ft.token?.symbol ?? "Unknown",
				value: getAmount(ft) * getPrice(ft.token),
			};
			tokenHeap.add(token);
			portfolioValue += token.value;
		}

		// Pop top 5 portfolio items (in value)
		const labels = [];
		const values = [];
		for(let i = 0; i < 5 && !tokenHeap.empty(); i++) {
			const token = tokenHeap.remove();
			if((token?.value ?? 0) < 0.01) continue;

			labels.push(token?.symbol ?? "");
			values.push((token?.value ?? 0) / portfolioValue);
		}

		// Aggregate other items in "Others"
		if(!tokenHeap.empty()) {
			labels.push("Others");
			values.push(1 - values.reduce((p, c) => p + c, 0));
		}

		// Form chart data
		const data = {
			labels: labels,
			datasets: [
				{
					label: "% Portfolio",
					data: values.map(x => 100 * x),
					backgroundColor: [
						'rgba(255, 99, 132, 0.8)',
						'rgba(54, 162, 235, 0.8)',
						'rgba(255, 206, 86, 0.8)',
						'rgba(75, 192, 192, 0.8)',
						'rgba(153, 102, 255, 0.8)',
						'rgba(255, 159, 64, 0.8)',
					],
					borderColor: [
						'rgba(255, 99, 132, 1)',
						'rgba(54, 162, 235, 1)',
						'rgba(255, 206, 86, 1)',
						'rgba(75, 192, 192, 1)',
						'rgba(153, 102, 255, 1)',
						'rgba(255, 159, 64, 1)',
					],
					borderWidth: 1,
				},
			],
		};
		return data;
	}

	// Standarize native token data
	const serializeNative = (chains: EvmChain[]): SerializedNative[] => chains.map(c => ({
		chainId: c.hex,
		name: c.currency?.name,
		symbol: c.currency?.symbol,
		balance: natives.get(c.hex) ?? 0,
		price: getNativePrice(c.hex),
	}));

	// Standarize ERC-20 token data
	const serializeFTs = (fts: Erc20Value[]): SerializedFT[] => fts.map(t => ({
		chainId: t.token?.chain.hex,
		tokenAddress: t.token?.contractAddress.lowercase,
		name: t.token?.name,
		symbol: t.token?.symbol,
		balance: getAmount(t),
		price: getPrice(t.token),
	}));

	// Change snapshot to the one user selected
	const selectSnapshot = (e: React.ChangeEvent<HTMLSelectElement>) => {
		setSelectedSnapshot(parseInt(e.currentTarget.value));
		e.preventDefault();
	}

	// Take a snapshot and save into user's localStorage
	const snapshot = (e: React.MouseEvent<HTMLButtonElement>) => {
		const newSnapshots: Snapshot[] = JSON.parse(localStorage.getItem("snapshots") || "[]");
		newSnapshots.push({
			timestamp: new Date().getTime(),
			natives: serializeNative(chains),
			fts: serializeFTs(fts),
			portfolioValue: chains.reduce((p, c) => p + ((natives.get(c.hex) ?? 0) * getNativePrice(c.hex)), 0) + fts.reduce((p, c) => p + (getAmount(c) * getPrice(c.token)), 0),
		});
		localStorage.setItem("snapshots", JSON.stringify(newSnapshots));
		setSnapshots(newSnapshots);
		e.preventDefault();
	}

	return (
		<div id="app">
			<h1>Crypto Portfolio Aggregator - by Lucas Yamamoto</h1>
			<div id="summary">
				<div id="summary-chart"><Doughnut
					data={generateChartData()}
				/></div>
				<div id="summary-accounts">
					<h3>My Accounts</h3>
					{accounts.length === 0 && <div>Add a wallet address you want to track</div>}
					{accounts.map((account, i) => <div key={`account-${i}-${account}`}>
						{account}
						<button onClick={removeAccount(account)}>[x]</button>
					</div>)}
					<div><input type="text" value={newAccount} onChange={handleNewAccountChange} onKeyDown={addAccount} /></div>
				</div>
				<div id="summary-chains">
					{CHAINS.map(chain => <div key={`chain-${chain.hex}`} className={`summary-chain ${chains.some(c => c.hex === chain.hex) ? "selected" : ""}`} onClick={toggleChain(chain)}>
						<img src={`images/chain-icons/${parseInt(chain.hex, 16)}.webp`} onError={(e) => { e.currentTarget.src = "/images/chain-icons/unknown.png"; }} />
						<div>{chain.name}</div>
					</div>)}
				</div>
			</div>
			<div id="snapshot-select">
				Select snapshot:
				<select onChange={selectSnapshot}>
					{snapshots.map((snapshot, i) => <option key={`snapshot-${i}`} selected={selectedSnapshot === i} value={i}>{((date: Date) => `${date.getMonth()+1}/${date.getDate()}/${date.getFullYear()} ${date.getHours()}:${date.getMinutes()}`)(new Date(snapshot.timestamp))}</option>)}
					<option selected={selectedSnapshot === -1} value={-1}>Current</option>
				</select>
			</div>
			<div id="assets">
				<div id="assets-header">
					<h2>My Assets <span className="light">{Intl.NumberFormat("en-us", { style: "currency", currency: "USD" }).format(chains.reduce((p, c) => p + ((natives.get(c.hex) ?? 0) * getNativePrice(c.hex)), 0) + fts.reduce((p, c) => p + (getAmount(c) * getPrice(c.token)), 0))}</span></h2>
					<div id="asset-hide"><input key={`hide-zeros-${hideZeros ? "checked" : "unckecked"}`} id="hide-zeros" type="checkbox" checked={hideZeros} defaultChecked={true} onClick={toggleHideZeros} /> <label htmlFor="hide-zeros">Hide unworthy</label></div>
				</div>
				<div id="assets-list">
					<>
						<div className="asset-header">Token</div>
						<div className="asset-header">Price</div>
						<div className="asset-header">Amount</div>
						<div className="asset-header">Value</div>
					</>
					{chains.length + fts.length === 0 && <div>No asset found</div>}
					{(selectedSnapshot === -1 ? serializeNative(chains) : snapshots[selectedSnapshot].natives).map((native, i) => (
						(!hideZeros || native.price * native.balance > 0) &&
						<React.Fragment key={`asset-native-${i}`}>
							<div className="asset-token" title={native.chainId}>
								<div className="asset-icon"><img src={`/images/chain-icons/${parseInt(native.chainId, 16)}.webp`} onError={(e) => { e.currentTarget.src = "/images/token-icons/unknown.png"; }} /></div>
								<div className="asset-name">{native.name}</div>
								<div className="asset-symbol">{native.symbol}</div>
							</div>
							<div className="asset-price">{Intl.NumberFormat("en-us", { style: "currency", currency: "USD" }).format(native.price)}</div>
							<div className="asset-amount">{normalizeAmount(native.balance ?? 0)}</div>
							<div className="asset-value">{Intl.NumberFormat("en-us", { style: "currency", currency: "USD" }).format(native.balance * native.price)}</div>
						</React.Fragment>
					))}
					{(selectedSnapshot === -1 ? serializeFTs(fts) : snapshots[selectedSnapshot].fts).map((token, i) => (
						(!hideZeros || token.price * token.balance > 0) &&
						<React.Fragment key={`asset-${i}`}>
							<div className="asset-token" title={token.tokenAddress}>
								<div className="asset-icon"><img src={`/images/token-icons/${token.tokenAddress ?? "unknown"}.png`} onError={(e) => { e.currentTarget.src = "/images/token-icons/unknown.png"; }} /></div>
								<div className="asset-name">{token.name}</div>
								<div className="asset-symbol">{token.symbol}</div>
							</div>
							<div className="asset-price">{Intl.NumberFormat("en-us", { style: "currency", currency: "USD" }).format(token.price)}</div>
							<div className="asset-amount">{normalizeAmount(token.balance)}</div>
							<div className="asset-value">{Intl.NumberFormat("en-us", { style: "currency", currency: "USD" }).format(token.balance * token.price)}</div>
						</React.Fragment>
					))}
				</div>
			</div>
			<div id="snapshot-button"><button onClick={snapshot}>Save Snapshot</button></div>
	  	</div>
	);
}

// Heap data structure used to get top 5 portfolio items
class TokenHeap {
	private items: { symbol: string, value: number }[] = [];

	private left(i: number) { return 2 * i + 1; }
	private right(i: number) { return 2 * i + 2; }
	private parent(i: number) { return Math.floor((i - 1) / 2); }

	private swap(i: number, j: number) {
		[this.items[i], this.items[j]] = [this.items[j], this.items[i]];
	}

	private heapifyDown(i: number) {
		let max = i;

		const l = this.left(i);
		const r = this.right(i);

		if(l < this.items.length && this.items[l].value > this.items[max].value) max = l;
		if(r < this.items.length && this.items[r].value > this.items[max].value) max = r;

		if(i !== max) {
			this.swap(i, max);
			this.heapifyDown(max);
		}
	}

	private heapifyUp(i: number) {
		const p = this.parent(i);
		let max = p;

		if(p >= 0 && this.items[i].value > this.items[p].value) max = i;

		if(p !== max) {
			this.swap(p, max);
			this.heapifyUp(p);
		}
	}

	peek() {
		return this.items[0];
	}

	add(item: { symbol: string, value: number }) {
		this.items.push(item);
		this.heapifyUp(this.items.length - 1);
	}

	remove() {
		this.swap(0, this.items.length - 1);
		const item = this.items.pop();
		this.heapifyDown(0);
		return item;
	}

	empty() {
		return this.items.length === 0;
	}
}

export default App;

