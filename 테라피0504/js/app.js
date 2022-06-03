function scheduler(action, ms = 1000, runRightNow = true) {
  if (runRightNow) action();
  setInterval(action, ms);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const config = {
  contracts: {
    ERC721: {
      abi: abi.ERC721,
      //TherapyV1 Contract Address
      address: '0x6F801F175838d8aDF845717Ff441d7123E3D2d35',
    },
    buyERC721: {
      abi: abi.buyERC721,
      //TherapyV1Sale Contract Address
      address: '0x12dE4e9a70e103aE792a8337f4e89D849dae3000',
    },
  },
};

const App = {
  provider: null,
  currentAccount: null,
  connected: false,

  init: async function () {
    await App.initCaver();
    await ERC721.init();
    await buyERC721.init();
    
    //NFT홈페이지에 들어가면 ERC721.pageInit함수가 실행됩니다.
    if (pageName === 'NFT') {
      await ERC721.pageInit();
    }
  },
  initCaver: async function () {
    //클레이튼 주입 여부 + 주입된 클레이튼이 Kaikas인지 확인
    if (typeof window.klaytn !== 'undefined' && klaytn.isKaikas) {
      // Kaikas user detected. You can now use the provider.
      provider = window['klaytn'];
    }else{
      alert('There is no Kaikas. Please install Kaikas.').close(5000);
    }

    try {
      await App.connect();
      await App.chnaged();
    } catch (error) {
      if (error.code === 4001) {
        // User rejected request
        alert('Please reflesh this page (F5)').close(3000);
      }
      console.log(error);
    }
  },
  connect: async function () {
    //Kakias가 enable상태가 아니라면 enable요청.
    if(window.klaytn.selectedAddress === undefined){
      await window.klaytn.enable();
    }
    App.currentAccount = window.klaytn.selectedAddress;
    App.connected= true;
  },
  chnaged: async function () {
    window.klaytn.on('accountsChanged', async () => {
      await App.connect();
    });
  },

  CheckId: async function () {

    document.getElementById("Account").innerHTML = "Your Kaikas Address : " + window.klaytn.selectedAddress;
  },

  ConnectId: async function() {
        if(window.klaytn.selectedAddress === undefined){
      await window.klaytn.enable();
    }
    App.currentAccount = window.klaytn.selectedAddress;
    App.connected= true;
  }
};


const ERC721 = {
  contract: null,
  baseURI: '',

  init: async function () {
    // window에거 caver를 이미 가져왔다고 가정. 없어도 초기화 하려면 별도 import필요
    this.contract = new window.caver.klay.Contract(
      config.contracts.ERC721.abi,
      config.contracts.ERC721.address,
    );
  },
  pageInit: async function () {
    this.writeMaxSupply();
    scheduler(this.writeTotalSupply, 1000);

    this.baseURI = await this.getBaseURI();
    if (App.connected) this.showMyNFTs();
  },

  getBaseURI: async function () {
    return await ERC721.contract.methods.getBaseURI().call();
  },
  getMaxSupply: async function () {
    return await ERC721.contract.methods.MAX_SUPPLY().call();
  },
  getTotalSupply: async function () {
    return await ERC721.contract.methods.totalSupply().call();
  },
  getBalanceOf: async function (address) {
    return await ERC721.contract.methods.balanceOf(address).call();
  },
  getOwnerOf: async function (address) {
    return await ERC721.contract.methods.ownerOf(address).call();
  },
  sendToken: async function (tokenID, toAddress) {
    alert(`send LoveHeo NFT #${tokenID} to ${toAddress}`);
    const evmData = ERC721.contract.methods
      .transferFrom(App.currentAccount, toAddress, tokenID)
      .encodeABI();

    const params = [
      {
        from: App.currentAccount,
        to: config.contracts.ERC721.address,
        data: evmData,
        value: '0x0',
      },
    ];
    klaytn
      .sendAsync({
        method: 'klay_sendTransaction',
        params,
      })
      .then((result) => {
        alert.close();
        console.log(result);
      })
      .catch((error) => {
        console.error(error);
      });
  },
  //if show reveal, delete tokenid in ugetMetadata;
  //ERC721.baseURI is img.json file
  //using if statement
  //
  getreveal: async function() {
    return await ERC721.contract.methods.reveal.call();
  },

  getMetadata: async function (tokenId) {
    const tokenURI = ERC721.baseURI + tokenId;
    const result = await fetch(tokenURI);
    return await result.json(); 
  },

  clickTokenTransfer: async function (tokenId) {
    const toAddress = prompt(`send LoveHeo NFT #${tokenId}, input toAddress`);
    if (!toAddress) alert('input valid ToAddress').close(2000);
    ERC721.sendToken(tokenId, toAddress);
  },
  makeNFTElement: function (tokenId, imagePath, attribute) {
    const div = document.createElement('div');
    div.classList.add('col');
    div.style = 'width: 20%;';
    {
      // card
      const card = document.createElement('div');
      card.classList.add('card');
      card.classList.add('h-100');
      div.appendChild(card);
      div.onclick = function () {
        ERC721.clickTokenTransfer(tokenId);
      };
      {
        // image
        const img = document.createElement('img');
        img.classList.add('card-img-top');
        img.src = imagePath;
        img.alt = '...';
        card.appendChild(img);
      }

    }
    return div;
  },

  appendNFT: async function (tokenId) {
    const metadata = await ERC721.getMetadata(tokenId);
    const nftElement = ERC721.makeNFTElement(
      tokenId,
      metadata.image,
      metadata.attributes,
    );
    document.getElementById('my-nft-list').appendChild(nftElement);

    const tmp = document.querySelector('#my-nft-list span');
    if (tmp) {
      tmp.remove();
    }
  },

  showMyNFTs: async function () {
    const balance = await ERC721.getBalanceOf(App.currentAccount);
    const total = await ERC721.getTotalSupply();

    let ownerCount = 0;
    for (const index of Array.from(Array(Number(total)).keys())) {
      const tokenId = index + 1;
      const owner = await ERC721.getOwnerOf(tokenId);
      if (owner.toLowerCase() == App.currentAccount.toLowerCase()) {
        ownerCount += 1;
        ERC721.appendNFT(tokenId);
        await sleep(1000); // for Pinata GWS req limit
        if (balance <= ownerCount) break;
      }
    }
  },
  writeMaxSupply: async function () {
   document.getElementById('max-supply').innerHTML =
    await ERC721.getMaxSupply();
  },
  writeTotalSupply: async function () {
    document.getElementById('total-supply').innerHTML =
      await ERC721.getTotalSupply();
  },
};

const buyERC721 = {
  contract: null,
  //컨트렉트와 연결해서 지속적으로 바뀌는방법을 추구하고싶음.
  init: async function () {
    // do nothing
    this.contract = new window.caver.klay.Contract(
      config.contracts.buyERC721.abi,
      config.contracts.buyERC721.address,  
    );
  },


  getIsSale: async function () {
    return await buyERC721.contract.methods.isSale().call();
  },

  getWLIsSale: async function () {
    return await buyERC721.contract.methods.WLisSale().call();
  },

  //화리전용으로 하나 만들어요 아래 코드 복사해서
  mintWithETH: async function () {
    const isSale = await buyERC721.getIsSale();
    var getMyPirce = 599;
    if (!isSale) {
       alert('The sale has not started.').close(3000);
       return;
    }
    const numberOfTokens = document.getElementById('number-of-tokens').value;
    if (numberOfTokens > 3)
      return alert('only mint 3 NFT at a time').close(3000);

    const sendValue = new BigNumber(window.caver.utils.toPeb(numberOfTokens, 'KLAY'))
      .multipliedBy(getMyPirce)
      .toFixed();

    const tx = buyERC721.contract.methods.mintByETH(numberOfTokens);
    //let estimateGas = await tx.estimateGas(); //카이카스가 사용하는 caver 1.4.1에 버그 있어서 제거

    tx.send({
      from: window.klaytn.selectedAddress,
      //gas: estimateGas,
      gas : 1500000,
      value: caver.utils.toHex(sendValue)
    })
    .on('transactionHash', function(hash) {
      console.log("transactionHash:" + hash)
    })
    .on('receipt', function(receipt) {
      console.log("receipt:" + receipt)
    })
    .on('error', console.error);
  },

  WLmintWithETH: async function () {
    const WLisSale = await buyERC721.getWLIsSale();
    var WLgetMyPrice = 349;
    if (!WLisSale) {
       alert('The sale has not started.').close(3000);
       return;
    }
    const numberOfTokens1 = document.getElementById('number-of-tokens1').value;
    if (numberOfTokens1 > 3)
      return alert('only mint 3 NFT at a time').close(3000);

    const sendValue1 = new BigNumber(window.caver.utils.toPeb(numberOfTokens1, 'KLAY'))
      .multipliedBy(WLgetMyPrice)
      .toFixed();

    const tx = buyERC721.contract.methods.WLmintByETH(numberOfTokens1);
    //let estimateGas = await tx.estimateGas(); //카이카스가 사용하는 caver 1.4.1에 버그 있어서 제거

    tx.send({
      from: window.klaytn.selectedAddress,
      //gas: estimateGas,
      gas : 1500000,
      value: caver.utils.toHex(sendValue1)
    })
    .on('transactionHash', function(hash) {
      console.log("transactionHash:" + hash)
    })
    .on('receipt', function(receipt) {
      console.log("receipt:" + receipt)
    })
    .on('error', console.error);
  },
};

App.init();
