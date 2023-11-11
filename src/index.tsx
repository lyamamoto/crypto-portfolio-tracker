import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.scss';
import App from './app';
import reportWebVitals from './reportWebVitals';
import Moralis from 'moralis';

const root = ReactDOM.createRoot(
	document.getElementById('root') as HTMLElement
);

// Suggestion: use your own Moralis API Key, as those ones are free tier and have limited requests per day
Moralis.start({
	//apiKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJub25jZSI6IjE0YzdmYzU0LTMzYTAtNDlmYS1iODJkLTFkYjNjMTFkYjI5ZCIsIm9yZ0lkIjoiMzYzMTMzIiwidXNlcklkIjoiMzczMjA4IiwidHlwZUlkIjoiZjFjNWYyYTMtMDMzNC00OTc1LWFmM2MtNDg3NDE1ZWE5MDA0IiwidHlwZSI6IlBST0pFQ1QiLCJpYXQiOjE2OTg5NDkxMzUsImV4cCI6NDg1NDcwOTEzNX0.vo-6s1IoMLQBB8aK2gFXbZBK2DwyjR0u-Qrha1u0Jmc",
	apiKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJub25jZSI6IjQ2NmUyMzk3LWRkYTQtNDMwOS04MzA3LThlZjBhYWFlZDgxMCIsIm9yZ0lkIjoiMzY0MDQ5IiwidXNlcklkIjoiMzc0MTUxIiwidHlwZUlkIjoiYzEyZmEzOTctNmM2OC00NjExLWE2MzItNWM5NzIyOGQwNDRiIiwidHlwZSI6IlBST0pFQ1QiLCJpYXQiOjE2OTk2NTI4NDQsImV4cCI6NDg1NTQxMjg0NH0.b4A3WY5u-f3aHqwrxb_5U3drFdRhmudAejQQgy5GLeQ",
}).then(async _ => {
	root.render(
		<React.StrictMode>
			<App />
		</React.StrictMode>
	);
});

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
