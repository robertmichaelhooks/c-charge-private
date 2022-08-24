import React, { createContext, useContext, useReducer } from 'react';
import Web3Modal from 'web3modal';
import WalletConnectProvider from '@walletconnect/web3-provider';
import { ethers } from 'ethers';
import Web3 from 'web3';
import {
  CHAIN_ID,
  CODE_SWITCH_ERROR,
  CONTRACT_ABI,
  CONTRACT_ADDRESS,
  ERROR,
  MESSAGE_SWITCH_NETWORK,
  MESSAGE_WALLET_CONNECT_ERROR,
  WALLET_CONNECT_INFURA_ID,
  WARNING,
} from '../utils/constants';
import { AlertMessageContext } from './AlertMessageContext';

// ----------------------------------------------------------------------

const initialState = {
  currentAccount: '',
  provider: null,
  signer: null,
  contract: null
};

const handlers = {
  SET_CURRENT_ACCOUNT: (state, action) => {
    return {
      ...state,
      currentAccount: action.payload
    };
  },
  SET_PROVIDER: (state, action) => {
    return {
      ...state,
      provider: action.payload
    };
  },
  SET_CONTRACT: (state, action) => {
    return {
      ...state,
      contract: action.payload
    };
  },
  SET_SIGNER: (state, action) => {
    return {
      ...state,
      signer: action.payload
    };
  }
};

const reducer = (state, action) =>
  handlers[action.type] ? handlers[action.type](state, action) : state;

//  Context
const WalletContext = createContext({
  ...initialState,
  connectWallet: () => Promise.resolve(),
  disconnectWallet: () => Promise.resolve(),
});

//  Provider
function WalletProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const { openAlert } = useContext(AlertMessageContext);

  const getWeb3Modal = async () => {
    const web3Modal = new Web3Modal({
      network: 'mainnet',
      cacheProvider: true,
      providerOptions: {
        walletconnect: {
          package: WalletConnectProvider,
          options: {
            infuraId: WALLET_CONNECT_INFURA_ID,
            rpc: {
              56: 'https://bsc-dataseed1.binance.org/'
            },
            chainId: CHAIN_ID
          },
        },
      }
    });
    return web3Modal;
  };

  /** Connect wallet */
  const connectWallet = async () => {
    try {
      const web3Modal = await getWeb3Modal();
      const connection = await web3Modal.connect();
      const provider = new ethers.providers.Web3Provider(connection);
      await web3Modal.toggleModal();

      // regular web3 provider methods
      const newWeb3 = new Web3(connection);
      let accounts = await newWeb3.eth.getAccounts();

      let signer = null;
      let contract = null;
      const { chainId } = await provider.getNetwork();
      console.log('>>>>>> chainId => ', chainId);

      /* --------------- Switch network --------------- */
      if (chainId === CHAIN_ID) {
        // accounts = await provider.listAccounts();
        signer = await provider.getSigner();
        console.log('>>>>>> signer => ', signer);
        contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
        console.log('>>>>> contract => ', contract);

        dispatch({
          type: 'SET_CURRENT_ACCOUNT',
          payload: accounts[0]
        });

        dispatch({
          type: 'SET_PROVIDER',
          payload: provider
        });

        dispatch({
          type: 'SET_CONTRACT',
          payload: contract
        });

        dispatch({
          type: 'SET_SIGNER',
          payload: signer
        });
      } else {
        if (window.ethereum) {
          try {
            await window.ethereum.request({
              method: 'wallet_switchEthereumChain',
              params: [{ chainId: `0x${CHAIN_ID.toString(16)}` }],
            });
          } catch (error) {
            if (error.code === CODE_SWITCH_ERROR) {
              /* ------------ Add new chain ------------- */
              await window.ethereum.request({
                method: 'wallet_addEthereumChain',
                params: [
                  {
                    chainId: `0x${CHAIN_ID.toString(16)}`,
                    chainName: CHAIN_NAME,
                    rpcUrls: RPC_URLS,
                    blockExplorerUrls: BLOCK_EXPLORER_URLS,
                    nativeCurrency: {
                      name: NATIVE_CURRENCY_NAME,
                      symbol: NATIVE_CURRENCY_SYMBOL, // 2-6 characters length
                      decimals: DECIMALS,
                    }
                  },
                ],
              });
              /* ---------------------------------------- */
            } else {
              throw error;
            }
          }
        } else {
          openAlert({
            severity: WARNING,
            message: MESSAGE_SWITCH_NETWORK
          });
        }
      }
      /* ---------------------------------------------- */
    } catch (error) {
      console.log('>>>>> error => ', error);
      dispatch({
        type: 'SET_CURRENT_ACCOUNT',
        payload: ''
      });

      dispatch({
        type: 'SET_PROVIDER',
        payload: null
      });

      dispatch({
        type: 'SET_CONTRACT',
        payload: null
      });

      dispatch({
        type: 'SET_SIGNER',
        payload: null
      });

      openAlert({
        severity: ERROR,
        message: MESSAGE_WALLET_CONNECT_ERROR
      });
    }
  };

  /** Disconnect wallet */
  const disconnectWallet = async () => {
    dispatch({
      type: 'SET_CURRENT_ACCOUNT',
      payload: ''
    });

    dispatch({
      type: 'SET_PROVIDER',
      payload: null
    });

    dispatch({
      type: 'SET_CONTRACT',
      payload: null
    });

    dispatch({
      type: 'SET_SIGNER',
      payload: null
    });
  };

  return (
    <WalletContext.Provider
      value={{
        ...state,
        connectWallet,
        disconnectWallet,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export { WalletContext, WalletProvider };