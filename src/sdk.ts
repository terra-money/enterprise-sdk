import { enterprise_factory, enterprise } from 'types/contracts';
import { NetworkInfo, useWallet, useConnectedWallet, useLCDClient } from '@terra-money/wallet-provider';
import { contractQuery } from 'utils';
import { getNetworkOrLCD } from '@terra-money/apps/queries';
import { LCDClient } from '@terra-money/terra.js';
import { WalletLike, Wallet, wallet } from './wallet';
import Big, { BigSource } from 'big.js';
import { useQuery, UseQueryResult, UseQueryOptions } from 'react-query';
import { u } from '@terra-money/apps/types';
import { DAOSocials, DAOGovernanceConfig, DAO } from 'types';
import { MultisigMember } from 'types/MultisigMember';
import { toProposal } from 'utils/toProposal';
import { assertDefined } from 'utils/assertDefined';
import { Proposal } from 'types/proposal';
import { ApiEndpoints, useApiEndpoint } from 'utils/hooks/useApiEndpoint';
import { QUERY_KEY } from 'types/queryKey';
import { useContract } from 'utils/hooks/useContract';
import { useContractAddress } from 'utils/hooks/useContractAddress';
import { compareAddress } from 'utils/compareAddress';

export interface UseProposalVotesQueryOptions {
  contract: CW20Addr;
  proposalId: number;
  limit?: number;
}
export type NominalType<T extends BigSource> = { __type: T };
export type CW20Addr = string & NominalType<'CW20Addr'>;
export type Frequency = 'week' | 'day' | 'hour' | 'minute';
export type ProposalsQueryArguments = Extract<enterprise.QueryMsg, { proposals: {} }>;
export type CouncilProposalsQueryArguments = Extract<enterprise.QueryMsg, { council_proposals: {} }>;
export type DAOsQueryResponse = Array<{
  address: string;
  type: enterprise.DaoType;
  name: string;
  description: string | undefined;
  logo: string | undefined;
  membershipContractAddress: string;
  enterpriseFactoryContract: string;
  socials: DAOSocials;
  config: DAOGovernanceConfig;
  council: enterprise.DaoCouncil;
}>;
export type Variables = {
  collectionAddr: string;
  tokenId: string;
};
export type TokenIds = string[];
export type Direction = 'asc' | 'desc';
export interface DAOsQueryOptions {
  query?: string;
  limit?: number;
  direction?: Direction;
  queryKey?: QUERY_KEY;
}
export interface UseDAOProposalsQueryOptions {
  address: string;
  direction?: Direction;
  enabled?: boolean;
}
export interface UseProposalQueryOptions {
  daoAddress: CW20Addr;
  id: number;
  enabled?: boolean;
}
export interface UseProposalsQueryOptions {
  daoAddress?: string;
  limit?: number;
  direction?: Direction;
  enabled?: boolean;
  queryKey?: QUERY_KEY;
}
export enum TX_KEY {
  CREATE_DAO = 'TX:CREATE_DAO',
  STAKE_TOKEN = 'TX:STAKE_TOKEN',
  UNSTAKE_TOKEN = 'TX:UNSTAKE_TOKEN',
  STAKE_NFT = 'TX:STAKE_NFT',
  UNSTAKE_NFT = 'TX:UNSTAKE_NFT',
  CLAIM = 'TX:CLAIM',
  CREATE_PROPOSAL = 'TX:CREATE_PROPOSAL',
  EXECUTE_PROPOSAL = 'TX:EXECUTE_PROPOSAL',
  CAST_VOTE = 'TX:CAST_VOTE',
  DEPOSIT = 'TX:DEPOSIT',
}
export interface QueryRefetch {
  queryKey: QUERY_KEY;
  wait?: number;
}
export type ProposalsQueryResponse = Array<{
  daoAddress: string;
  id: number;
  created: number;
  title: string;
  description: string;
  expires: enterprise.Expiration;
  status: enterprise.ProposalStatus;
  proposalActions: enterprise.ProposalAction[];
  yesVotes: string;
  noVotes: string;
  abstainVotes: string;
  vetoVotes: string;
  totalVotes: string;
}>;
export type QueryRefetchMap = Record<TX_KEY, (QUERY_KEY | QueryRefetch)[]>;
export const QUERY_REFETCH_MAP: QueryRefetchMap = {
  [TX_KEY.CREATE_DAO]: [QUERY_KEY.DAOS, QUERY_KEY.RECENT_DAOS],
  [TX_KEY.DEPOSIT]: [QUERY_KEY.TREASURY_TOKENS],
  [TX_KEY.STAKE_TOKEN]: [
    QUERY_KEY.CW20_TOKEN_BALANCE,
    QUERY_KEY.TOKEN_STAKING_AMOUNT,
    QUERY_KEY.VOTING_POWER,
    QUERY_KEY.RELEASABLE_CLAIMS,
    QUERY_KEY.CLAIMS,
    QUERY_KEY.NATIVE_BALANCE,
  ],
  [TX_KEY.UNSTAKE_TOKEN]: [
    QUERY_KEY.CW20_TOKEN_BALANCE,
    QUERY_KEY.TOKEN_STAKING_AMOUNT,
    QUERY_KEY.VOTING_POWER,
    QUERY_KEY.RELEASABLE_CLAIMS,
    QUERY_KEY.CLAIMS,
    QUERY_KEY.NATIVE_BALANCE,
  ],
  [TX_KEY.STAKE_NFT]: [
    QUERY_KEY.CW721_TOKENS,
    QUERY_KEY.NFT_STAKING_AMOUNT,
    QUERY_KEY.NFT_STAKING,
    QUERY_KEY.VOTING_POWER,
    QUERY_KEY.RELEASABLE_CLAIMS,
    QUERY_KEY.CLAIMS,
    QUERY_KEY.NATIVE_BALANCE,
  ],
  [TX_KEY.UNSTAKE_NFT]: [
    QUERY_KEY.CW721_TOKENS,
    QUERY_KEY.NFT_STAKING_AMOUNT,
    QUERY_KEY.NFT_STAKING,
    QUERY_KEY.VOTING_POWER,
    QUERY_KEY.RELEASABLE_CLAIMS,
    QUERY_KEY.CLAIMS,
    QUERY_KEY.NATIVE_BALANCE,
  ],
  [TX_KEY.CLAIM]: [
    QUERY_KEY.CW20_TOKEN_BALANCE,
    QUERY_KEY.TOKEN_STAKING_AMOUNT,
    QUERY_KEY.VOTING_POWER,
    QUERY_KEY.RELEASABLE_CLAIMS,
    QUERY_KEY.CLAIMS,
    QUERY_KEY.NATIVE_BALANCE,
  ],
  [TX_KEY.CREATE_PROPOSAL]: [QUERY_KEY.PROPOSALS, QUERY_KEY.RECENT_PROPOSALS, QUERY_KEY.NATIVE_BALANCE],
  [TX_KEY.EXECUTE_PROPOSAL]: [QUERY_KEY.PROPOSALS, QUERY_KEY.PROPOSAL, QUERY_KEY.NATIVE_BALANCE],
  [TX_KEY.CAST_VOTE]: [QUERY_KEY.PROPOSALS, QUERY_KEY.PROPOSAL, QUERY_KEY.PROPOSAL_VOTES, QUERY_KEY.NATIVE_BALANCE],
};

export class EnterpriseSdk {
  public wallet: Wallet;
  public contractAddress: string;

  constructor(walletLike: WalletLike, contractAddress: string) {
    this.wallet = wallet(walletLike);
    this.contractAddress = contractAddress;
  }

  public async fetchProposalStatus(
    network: NetworkInfo,
    daoAddress: string,
    id: number
  ): Promise<enterprise.ProposalStatusResponse | undefined> {
    const response = await contractQuery<enterprise.QueryMsg, enterprise.ProposalStatusResponse>(
      network,
      daoAddress as CW20Addr,
      {
        proposal_status: {
          proposal_id: id,
        },
      }
    );
    return response;
  }

  public async fetchStakingAmount(
    networkOrLCD: NetworkInfo | LCDClient,
    daoAddress: CW20Addr,
    walletAddress?: CW20Addr
  ): Promise<u<Big>> {
    if (walletAddress === undefined) {
      const response = await contractQuery<enterprise.QueryMsg, { total_staked_amount: string }>(
        networkOrLCD,
        daoAddress,
        { total_staked_amount: {} }
      );
      return Big(response.total_staked_amount) as u<Big>;
    }

    const response = await contractQuery<enterprise.QueryMsg, enterprise.UserStakeResponse>(networkOrLCD, daoAddress, {
      user_stake: { user: walletAddress },
    });

    const amount =
      typeof response.user_stake === 'object'
        ? 'token' in response.user_stake
          ? Big(response.user_stake.token.amount)
          : Big(response.user_stake.nft.amount)
        : Big(0);

    return amount as u<Big>;
  }

  public async fetchBlockHeight(network: NetworkInfo): Promise<number> {
    const response = await fetch(`${network.lcd}/blocks/latest`);

    const json = await response.json();

    return +json.block.header.height;
  }

  useBlockHeightQuery(): UseQueryResult<number> {
    const { network } = useWallet();

    return useQuery(
      [QUERY_KEY.BLOCK_HEIGHT, network.lcd],
      () => {
        return this.fetchBlockHeight(network);
      },
      {
        refetchOnMount: true,
        refetchInterval: 60000,
      }
    );
  }

  public async useCommunityPoolQuery(): UseQueryResult<u<Big> | undefined> {
    const { network } = useWallet();

    return useQuery(
      [QUERY_KEY.COMMUNITY_POOL, network.name],
      async () => {
        const lcd = getNetworkOrLCD(network);

        const coins = await lcd.distribution.communityPool();

        const uLuna = coins.get('uluna');

        return Big(uLuna !== undefined ? uLuna.amount.toString() : '0') as u<Big>;
      },
      {
        refetchOnMount: false,
      }
    );
  }

  public async useContractInfoQuery(address: string) {
    const lcd = useLCDClient();

    return useQuery([QUERY_KEY.CONTRACT_INFO, address], async () => {
      return lcd.wasm.contractInfo(address);
    });
  }

  public async fetchDAOAssetsWhitelist(
    network: NetworkInfo,
    address: CW20Addr
  ): Promise<enterprise.AssetInfoBaseFor_Addr[]> {
    const response = await contractQuery<enterprise.QueryMsg, enterprise.AssetWhitelistResponse>(network, address, {
      asset_whitelist: {},
    });

    return response.assets;
  }

  public async useDAOAssetsWhitelist(daoAddress: string): UseQueryResult<enterprise.AssetInfoBaseFor_Addr[]> {
    const { network } = useWallet();

    return useQuery(
      [QUERY_KEY.ASSETS_WHITELIST, daoAddress],
      async () => {
        const whitelist = await this.fetchDAOAssetsWhitelist(network, daoAddress as CW20Addr);
        return whitelist;
      },
      {
        refetchOnMount: false,
      }
    );
  }

  public async fetchDAOAssetTreasury(network: NetworkInfo, address: CW20Addr): Promise<enterprise.AssetBaseFor_Addr[]> {
    const response = await contractQuery<enterprise.QueryMsg, enterprise.AssetTreasuryResponse>(network, address, {
      cw20_treasury: {},
    });

    return response.assets;
  }

  useDAOAssetTreasury = (daoAddress: string): UseQueryResult<enterprise.AssetBaseFor_Addr[]> => {
    const { network } = useWallet();

    return useQuery(
      [QUERY_KEY.CW20_TREASURY, daoAddress],
      () => this.fetchDAOAssetTreasury(network, daoAddress as CW20Addr),
      {
        refetchOnMount: false,
      }
    );
  };

  fetchDAONFTsWhitelist = async (network: NetworkInfo, address: CW20Addr) => {
    const response = await contractQuery<enterprise.QueryMsg, enterprise.NftWhitelistResponse>(network, address, {
      nft_whitelist: {},
    });

    return response.nfts;
  };

  public async useDAONFTsWhitelist(daoAddress: string) {
    const { network } = useWallet();

    return useQuery(
      [QUERY_KEY.NFTS_WHITELIST, daoAddress],
      async () => {
        const whitelist = await this.fetchDAONFTsWhitelist(network, daoAddress as CW20Addr);
        return whitelist;
      },
      {
        refetchOnMount: false,
      }
    );
  }

  fetchDAONFTTreasury = async (network: NetworkInfo, address: CW20Addr): Promise<enterprise.NftCollection[]> => {
    const response = await contractQuery<enterprise.QueryMsg, enterprise.NftTreasuryResponse>(network, address, {
      nft_treasury: {},
    });

    return response.nfts;
  };

  public async useDAONFTTreasury(daoAddress: string): UseQueryResult<enterprise.NftCollection[]> {
    const { network } = useWallet();

    return useQuery(
      [QUERY_KEY.NFT_TREASURY, daoAddress],
      () => this.fetchDAONFTTreasury(network, daoAddress as CW20Addr),
      {
        refetchOnMount: false,
      }
    );
  }

  public async useDaoProposalsQuery({
    address,
    enabled = true,
  }: UseDAOProposalsQueryOptions): UseQueryResult<Array<Proposal> | undefined> {
    const { query } = useContract();
    const { data: dao } = this.useDAOQuery(address as CW20Addr);

    return useQuery(
      [QUERY_KEY.PROPOSALS, address],
      async () => {
        const result: Proposal[] = [];
        try {
          const { proposals } = await query<ProposalsQueryArguments, enterprise.ProposalsResponse>(address, {
            proposals: {},
          });
          result.push(...proposals.map((resp) => toProposal(resp, assertDefined(dao), 'general')));
        } catch (err) {
          reportError(err);
        }

        try {
          const { proposals } = await query<CouncilProposalsQueryArguments, enterprise.ProposalsResponse>(address, {
            council_proposals: {},
          });
          result.push(...proposals.map((resp) => toProposal(resp, assertDefined(dao), 'council')));
        } catch (err) {
          console.log('Council', err);
          reportError(err);
        }

        return result.sort((a, b) => b.created - a.created);
      },
      {
        refetchOnMount: false,
        enabled: !!(enabled && dao),
      }
    );
  }

  public async useDAOQuery(address: CW20Addr): UseQueryResult<DAO | undefined> {
    const endpoint = useApiEndpoint({
      path: 'v1/daos/{address}',
      route: {
        address,
      },
    });
    return useQuery(
      [QUERY_KEY.DAO, endpoint],
      async () => {
        const response = await fetch(endpoint);

        if (response.status !== 404) {
          const entity: DAOsQueryResponse[0] = await response.json();

          return new DAO(
            entity.address,
            entity.type,
            entity.name,
            entity.description,
            entity.logo,
            entity.membershipContractAddress,
            entity.enterpriseFactoryContract,
            entity.socials,
            entity.config,
            entity.council
          );
        }

        return undefined;
      },
      {
        refetchOnMount: false,
      }
    );
  }

  fetchDAOsQuery = async (endpoint: string) => {
    const response = await fetch(endpoint);

    const json: DAOsQueryResponse = await response.json();

    return json.map((entity) => {
      return new DAO(
        entity.address,
        entity.type,
        entity.name,
        entity.description,
        entity.logo,
        entity.membershipContractAddress,
        entity.enterpriseFactoryContract,
        entity.socials,
        entity.config,
        entity.council
      );
    });
  };

  public async useDAOsQuery(options: DAOsQueryOptions = {}): UseQueryResult<Array<DAO> | undefined> {
    const { query, limit = 100, direction = query?.length === 0 ? 'desc' : 'asc', queryKey = QUERY_KEY.DAOS } = options;

    const endpoint = useApiEndpoint({
      path: 'v1/daos',
      params: {
        query,
        limit,
        direction,
      },
    });

    return useQuery([queryKey, endpoint], () => this.fetchDAOsQuery(endpoint), {
      refetchOnMount: false,
    });
  }

  public async useEnterpriseCodeIdsQuery() {
    const { network } = useWallet();
    const address = useContractAddress('enterprise-factory');

    return useQuery(
      [QUERY_KEY.CODE_IDS],
      async () => {
        const { code_ids } = await contractQuery<
          enterprise_factory.QueryMsg,
          enterprise_factory.EnterpriseCodeIdsResponse
        >(network, address, { enterprise_code_ids: {} });

        return code_ids;
      },
      {
        refetchOnMount: false,
      }
    );
  }

  public async fetchGlobalAssetsWhitelist(
    network: NetworkInfo,
    contractAddress: CW20Addr
  ): Promise<enterprise.AssetInfoBaseFor_Addr[]> {
    const response = await contractQuery<enterprise_factory.QueryMsg, enterprise.AssetWhitelistResponse>(
      network,
      contractAddress,
      { global_asset_whitelist: {} }
    );

    return response.assets;
  }

  public async useGlobalAssetsWhitelist(): UseQueryResult<enterprise.AssetInfoBaseFor_Addr[]> {
    const { network } = useWallet();

    const contractAddress = useContractAddress('enterprise-factory');

    return useQuery(
      [QUERY_KEY.GLOBAL_ASSETS_WHITELIST, contractAddress],
      () => this.fetchGlobalAssetsWhitelist(network, contractAddress),
      {
        refetchOnMount: false,
      }
    );
  }

  public async useMultisigMembersQuery(contractAddress: CW20Addr) {
    const { network } = useWallet();

    return useQuery(
      [QUERY_KEY.MULTISIG_MEMBERS, contractAddress],
      async (): Promise<MultisigMember[]> => {
        const { members } = await contractQuery<enterprise.QueryMsg, enterprise.MultisigMembersResponse>(
          network,
          contractAddress,
          { list_multisig_members: {} }
        );

        return members.map((member) => ({ addr: member.address, weight: Number(member.weight) }));
      },
      {
        refetchOnMount: false,
      }
    );
  }

  public async fetchNativeBalance(
    networkOrLCD: NetworkInfo | LCDClient,
    walletAddr: string,
    denom: string
  ): Promise<u<Big>> {
    const lcd =
      networkOrLCD instanceof LCDClient
        ? networkOrLCD
        : new LCDClient({
            URL: networkOrLCD.lcd,
            chainID: networkOrLCD.chainID,
          });

    const [coins] = await lcd.bank.balance(walletAddr);

    const coin = coins.get(denom);

    return Big(coin === undefined ? 0 : coin.amount.toNumber()) as u<Big>;
  }

  public async useNativeBalanceQuery(): UseQueryResult<u<Big> | undefined> {
    const connectedWallet = useConnectedWallet();

    return useQuery(
      [QUERY_KEY.NATIVE_BALANCE],
      () => this.fetchNativeBalance(connectedWallet!.network, connectedWallet!.walletAddress, 'uluna'),
      {
        refetchOnMount: false,
        enabled: connectedWallet !== undefined,
      }
    );
  }

  public createCollectionQuery = (vars: Variables) => {
    return `
    query MyQuery {
      tokensPage(collectionAddr:"${vars.collectionAddr}", tokenId: "${vars.tokenId}") {
        collection {
          collectionAddr
          collectionName
          collectionInfo
          traitsCount
        }
        token {
          name
          imageUrlFileserver
          market
          traits
          listing
          price
          denom
          marketListing
          rarity
          rank
          expiration
          status
          owner
          dealScore
          collectionAddr
          tokenId
        }
      }
    }
  `;
  };

  public async fetchNFTData(collectionAddr: string, tokenId: string): Promise<enterprise.NftCollection[]> {
    const variables: Variables = {
      collectionAddr,
      tokenId,
    };
    const response = await fetch('https://nft-terra2.tfm.dev/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: this.createCollectionQuery(variables),
      }),
    });

    const json = await response.json();

    return json;
  }

  public async fetchNFTDataForMultipleTokenIds(
    collectionAddr: string,
    tokenIds: TokenIds
  ): Promise<{ [tokenId: string]: any }> {
    const result: { [tokenId: string]: any } = {};

    for (const tokenId of tokenIds) {
      const data = await this.fetchNFTData(collectionAddr, tokenId);
      result[tokenId] = data;
    }

    return result;
  }

  public useNFTInfoQuery = (collectionAddr: string, tokenIds: string[]): UseQueryResult<enterprise.NftCollection[]> => {
    return useQuery([collectionAddr, tokenIds], () => {
      return this.fetchNFTDataForMultipleTokenIds(collectionAddr, tokenIds);
    });
  };

  public useNFTStakingAmountQuery(
    daoAddress: string,
    walletAddress?: string,
    options: Partial<Pick<UseQueryOptions, 'enabled'>> = { enabled: true }
  ): UseQueryResult<u<Big>> {
    const { network } = useWallet();

    return useQuery(
      [QUERY_KEY.NFT_STAKING_AMOUNT, daoAddress, walletAddress],
      () => this.fetchStakingAmount(network, daoAddress as CW20Addr, walletAddress as CW20Addr),
      {
        refetchOnMount: false,
        ...options,
      }
    );
  }
  public async fetchNFTStaking(
    networkOrLCD: NetworkInfo | LCDClient,
    daoAddress: CW20Addr,
    walletAddress: CW20Addr
  ): Promise<enterprise.NftUserStake | undefined> {
    const response = await contractQuery<enterprise.QueryMsg, enterprise.UserStakeResponse>(networkOrLCD, daoAddress, {
      user_stake: { user: walletAddress },
    });

    return typeof response.user_stake === 'object' && 'nft' in response.user_stake
      ? response.user_stake.nft
      : undefined;
  }

  public useNFTStakingQuery(
    daoAddress: string,
    walletAddress?: string,
    options: Partial<Pick<UseQueryOptions, 'enabled'>> = { enabled: true }
  ): UseQueryResult<enterprise.NftUserStake | undefined> {
    const { network } = useWallet();

    return useQuery(
      [QUERY_KEY.NFT_STAKING, daoAddress, walletAddress],
      () => this.fetchNFTStaking(network, daoAddress as CW20Addr, walletAddress as CW20Addr),
      {
        refetchOnMount: false,
        ...options,
      }
    );
  }

  public useProposalQuery(options: UseProposalQueryOptions): UseQueryResult<Proposal | undefined> {
    const { query } = useContract();

    const { id, daoAddress, enabled = true } = options;

    const { data: dao } = this.useDAOQuery(daoAddress as CW20Addr);

    return useQuery(
      [QUERY_KEY.PROPOSAL, daoAddress, id],
      async () => {
        try {
          let resp = await query<ProposalsQueryArguments, enterprise.ProposalResponse>(daoAddress, {
            proposal: { proposal_id: id },
          });
          return toProposal(resp, assertDefined(dao), 'general');
        } catch (err) {
          const councilProposal = await query<CouncilProposalsQueryArguments, enterprise.ProposalResponse>(daoAddress, {
            council_proposal: { proposal_id: id },
          });
          return toProposal(councilProposal, assertDefined(dao), 'council');
        }
      },
      {
        refetchOnMount: false,
        enabled: !!(enabled && dao),
      }
    );
  }

  public async useProposalsQuery(options: UseProposalsQueryOptions = {}): UseQueryResult<Array<Proposal> | undefined> {
    const { daoAddress, limit = 12, enabled = true, direction = 'desc', queryKey = QUERY_KEY.PROPOSALS } = options;

    const template: ApiEndpoints =
      daoAddress === undefined
        ? {
            path: 'v1/proposals',
            params: {
              limit,
              direction,
            },
          }
        : {
            path: 'v1/daos/{address}/proposals',
            route: {
              address: daoAddress,
            },
            params: {
              limit,
              direction,
            },
          };

    const endpoint = useApiEndpoint(template);

    // TODO: the Proposal classes need the DAO but this means that the DAO's need to be fetched too
    // or that the proposal returns the DAO in the API. For now this should work, but need a better
    // long term solution
    const { data: daos = [] } = this.useDAOsQuery({ limit: 100000 });

    return useQuery(
      [queryKey, endpoint],
      async () => {
        const response = await fetch(endpoint);

        const proposals: Proposal[] = [];

        if (response.status !== 404) {
          const json: ProposalsQueryResponse = await response.json();

          json.forEach((entity) => {
            const dao = daos.find((d) => compareAddress(d.address, entity.daoAddress));

            if (dao === undefined) {
              reportError('Could not find the correct DAO for the proposal');
            } else {
              proposals.push({
                ...entity,
                dao,
                actions: entity.proposalActions,
                yesVotes: Big(entity.yesVotes),
                noVotes: Big(entity.noVotes),
                abstainVotes: Big(entity.abstainVotes),
                vetoVotes: Big(entity.vetoVotes ?? '0'),
                totalVotes: Big(entity.totalVotes ?? '0'),
                votingType: 'general',
              });
            }
          });
        }

        return proposals;
      },
      {
        refetchOnMount: false,
        enabled: enabled && daos.length > 0,
      }
    );
  }

  public async useProposalVoteQuery(
    contract: string,
    member: string,
    proposalId: number,
    options: Partial<Pick<UseQueryOptions, 'enabled'>> = { enabled: true }
  ) {
    const { network } = useWallet();

    return useQuery(
      [QUERY_KEY.PROPOSAL_VOTE, contract, proposalId, member],
      async () => {
        const response = await contractQuery<enterprise.QueryMsg, enterprise.PollVoterResponse>(
          network,
          contract as CW20Addr,
          {
            member_vote: {
              member,
              proposal_id: proposalId,
            },
          }
        );
        return response.vote;
      },
      {
        refetchOnMount: false,
        ...options,
      }
    );
  }

  public async fetchReleasableClaims(
    networkOrLCD: NetworkInfo | LCDClient,
    daoAddress: CW20Addr,
    walletAddress: CW20Addr
  ): Promise<enterprise.Claim[]> {
    const response = await contractQuery<enterprise.QueryMsg, enterprise.ClaimsResponse>(networkOrLCD, daoAddress, {
      releasable_claims: { owner: walletAddress },
    });
    return response.claims;
  }

  public useReleasableClaimsQuery = (
    daoAddress: string,
    walletAddress: string,
    options: Partial<Pick<UseQueryOptions, 'enabled'>> = { enabled: true }
  ): UseQueryResult<enterprise.Claim[]> => {
    const { network } = useWallet();

    return useQuery(
      [QUERY_KEY.RELEASABLE_CLAIMS, daoAddress, walletAddress],
      () => {
        return this.fetchReleasableClaims(network, daoAddress as CW20Addr, walletAddress as CW20Addr);
      },
      {
        refetchOnMount: false,
        ...options,
      }
    );
  };

  public useTokenStakingAmountQuery(
    daoAddress: string,
    walletAddress?: string,
    options: Partial<Pick<UseQueryOptions, 'enabled'>> = { enabled: true }
  ): UseQueryResult<u<Big>> {
    const { network } = useWallet();

    return useQuery(
      [QUERY_KEY.TOKEN_STAKING_AMOUNT, daoAddress, walletAddress],
      () => this.fetchStakingAmount(network, daoAddress as CW20Addr, walletAddress as CW20Addr),
      {
        refetchOnMount: false,
        ...options,
      }
    );
  }

  public async fetchVotingPower(
    networkOrLCD: NetworkInfo | LCDClient,
    daoAddress: CW20Addr,
    walletAddress: CW20Addr
  ): Promise<Big> {
    const response = await contractQuery<enterprise.QueryMsg, enterprise.MemberInfoResponse>(networkOrLCD, daoAddress, {
      member_info: { member_address: walletAddress },
    });
    return Big(response.voting_power);
  }

  useVotingPowerQuery = (
    daoAddress?: string,
    walletAddress?: string,
    options: Partial<Pick<UseQueryOptions, 'enabled'>> = { enabled: true }
  ): UseQueryResult<Big | undefined> => {
    const { network } = useWallet();

    return useQuery(
      [QUERY_KEY.VOTING_POWER, daoAddress, walletAddress],
      () => this.fetchVotingPower(network, daoAddress as CW20Addr, walletAddress as CW20Addr),
      {
        ...options,
        refetchOnMount: false,
        enabled: options.enabled && Boolean(daoAddress && walletAddress),
      }
    );
  };
}
