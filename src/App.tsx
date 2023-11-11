import React from 'react';
import './app.scss';
import { Chart as ChartJS, ArcElement, Tooltip, ChartData } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import Moralis from 'moralis';
import { EvmChain, Erc20Value, Erc20Token } from '@moralisweb3/evm-utils';

ChartJS.register(ArcElement, Tooltip);

interface Wallet {
	address: string,
	chain: EvmChain,
}

const CHAINS = [
	EvmChain.ETHEREUM,
	EvmChain.POLYGON,
	EvmChain.BSC,
	EvmChain.ARBITRUM,
	EvmChain.OPTIMISM,
	EvmChain.AVALANCHE,
];

const WRAPPED_CONTRACTS = [
	"0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // wETH
	"0x7c9f4C87d911613Fe9ca58b579f737911AAD2D43", // wMATIC
	"0x418D75f65a02b3D53B2418FB8E1fe493759c7605", // wBNB
	"0xB50721BCf8d664c30412Cfbc6cf7a15145234ad1", // ARB
	"", //
	"0x85f138bfEE4ef8e540890CFb48F620571d67Eda3", // wAVAX
];

const storedAccounts: string[] = JSON.parse(localStorage.getItem("accounts") || "[]");
const storedRawChains: string[] = JSON.parse(localStorage.getItem("chains") || "[\"0x1\"]");
const storedChains = CHAINS.filter(c => storedRawChains.some(stored => stored === c.hex));

function App() {
	const [accounts, setAccounts] = React.useState<string[]>(storedAccounts);
	const [newAccount, setNewAccount] = React.useState<string>("");
	const [chains, setChains] = React.useState<EvmChain[]>(storedChains);
	const [natives, setNatives] = React.useState<Map<string, number>>(new Map());
	const [fts, setFTs] = React.useState<Erc20Value[]>([]);
	const [nativePrices, setNativePrices] = React.useState<Map<string, number>>(new Map());
	const [prices, setPrices] = React.useState<Map<string, Map<string, number>>>(new Map());
	const [hideZeros, setHideZeros] = React.useState<boolean>(true);

	const wallets = accounts.map(account => chains.map(chain => ({ address: account, chain } as Wallet))).flat();

	const loadNatives = async () => {
		const newNatives: Map<string, number> = new Map();

		for(const wallet of wallets) {
			const response = await Moralis.EvmApi.balance.getNativeBalance({
				address: wallet.address,
				chain: wallet.chain,
			});

			newNatives.set(wallet.chain.hex, (newNatives.has(wallet.chain.hex) ? newNatives.get(wallet.chain.hex)! : 0) + Number(response.result.balance.value) / Math.pow(10, 18));
		}

		setNatives(newNatives);
	}

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

	const loadAll = () => {
		loadNatives();
		loadFTs();
	}

	const storeAccounts = () => {
		localStorage.setItem("accounts", JSON.stringify(accounts));
	}

	const storeChains = () => {
		localStorage.setItem("chains", JSON.stringify(chains.map(c => c.hex)));
	}

	React.useEffect(() => { loadNativePrices(); }, [natives]);
	React.useEffect(() => { loadPrices(); }, [fts]);
	React.useEffect(loadAll, [accounts, chains]);
	React.useEffect(storeAccounts, [accounts]);
	React.useEffect(storeChains, [chains]);

	const handleNewAccountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		setNewAccount(e.currentTarget.value);
		e.preventDefault();
	}

	const addAccount = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if(e.key === "Enter" && !accounts.some(a => a === newAccount)) {
			setAccounts([...accounts, newAccount]);
		}
		e.preventDefault();
	}

	const removeAccount = (account: string) => {
		return (e: React.MouseEvent<HTMLButtonElement>) => {
			if(accounts.some(a => a === account)) {
				setAccounts(accounts.filter(a => a !== account));
			}
			e.preventDefault();
		}
	}

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

	const toggleHideZeros = (e: React.FormEvent<HTMLInputElement>) => {
		setHideZeros(old => !old);
		e.preventDefault();
	}

	const getNativePrice = (chainId: string) => {
		return nativePrices.get(chainId) ?? 0;
	}

	const getPrice = (token: Erc20Token | null) => {
		return prices.get(token?.chain.hex ?? "0x-1")?.get(token?.contractAddress.lowercase ?? "") ?? 0;
	}

	const getAmount = (token: Erc20Value) => {
		return Number(token.amount) / Math.pow(10, token.decimals);
	}

	const normalizeAmount = (amount: number) => {
		let i = 0;
		while(amount >= 1e3) {
			amount /= 1e3;
			i++;
		}

		return `${amount.toFixed(2)}${["", "k", "M", "B", "T", "q", "Q"][i] ?? "?"}`;
	}

	const generateChartData = (): ChartData<"doughnut", number[], unknown> => {
		let portfolioValue = 0;

		const tokenHeap = new TokenHeap();
		for(const ft of fts) {
			const token = {
				symbol: ft.token?.symbol ?? "Unknown",
				value: getAmount(ft) * getPrice(ft.token),
			};
			tokenHeap.add(token);
			portfolioValue += token.value;
		}

		const labels = [];
		const values = [];
		for(let i = 0; i < 5 && !tokenHeap.empty(); i++) {
			const token = tokenHeap.remove();
			if((token?.value ?? 0) < 0.01) continue;

			labels.push(token?.symbol ?? "");
			values.push((token?.value ?? 0) / portfolioValue);
		}

		if(!tokenHeap.empty()) {
			labels.push("Others");
			values.push(1 - values.reduce((p, c) => p + c, 0));
		}

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
			<div id="assets">
				<div id="assets-header">
					<h2>My Assets <span className="light">{Intl.NumberFormat("en-us", { style: "currency", currency: "USD" }).format(fts.reduce((p, c) => p + (getAmount(c) * getPrice(c.token)), 0))}</span></h2>
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
					{chains.map((chain, i) => (
						(!hideZeros || getNativePrice(chain.hex) * (natives.get(chain.hex) ?? 0) > 0) &&
						<React.Fragment key={`asset-native-${i}`}>
							<div className="asset-token" title={chain.hex}>
								<div className="asset-icon"><img src={`/images/chain-icons/${parseInt(chain.hex, 16)}.webp`} onError={(e) => { e.currentTarget.src = "/images/token-icons/unknown.png"; }} /></div>
								<div className="asset-name">{chain.currency?.name}</div>
								<div className="asset-symbol">{chain.currency?.symbol}</div>
							</div>
							<div className="asset-price">{Intl.NumberFormat("en-us", { style: "currency", currency: "USD" }).format(getNativePrice(chain.hex))}</div>
							<div className="asset-amount">{normalizeAmount(natives.get(chain.hex) ?? 0)}</div>
							<div className="asset-value">{Intl.NumberFormat("en-us", { style: "currency", currency: "USD" }).format((natives.get(chain.hex) ?? 0) * getNativePrice(chain.hex))}</div>
						</React.Fragment>
					))}
					{fts.map((item, i) => (
						(!hideZeros || getPrice(item.token) * getAmount(item) > 0) &&
						<React.Fragment key={`asset-${i}`}>
							<div className="asset-token" title={item.token?.contractAddress.lowercase}>
								<div className="asset-icon"><img src={`/images/token-icons/${item.token?.contractAddress.lowercase ?? "unknown"}.png`} onError={(e) => { e.currentTarget.src = "/images/token-icons/unknown.png"; }} /></div>
								<div className="asset-name">{item.token?.name}</div>
								<div className="asset-symbol">{item.token?.symbol}</div>
							</div>
							<div className="asset-price">{Intl.NumberFormat("en-us", { style: "currency", currency: "USD" }).format(getPrice(item.token))}</div>
							<div className="asset-amount">{normalizeAmount(getAmount(item))}</div>
							<div className="asset-value">{Intl.NumberFormat("en-us", { style: "currency", currency: "USD" }).format(getAmount(item) * getPrice(item.token))}</div>
						</React.Fragment>
					))}
				</div>
			</div>
	  	</div>
	);
}

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

