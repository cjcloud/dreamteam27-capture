import React, { useState, forwardRef, useEffect } from "react";

import {useCart} from "react-use-cart";
import Football24 from "./logo.jsx";

import { useSelectionContext } from "../context/SelectionContext.js";
import "../css/App.css";

//=====================Team Builder Component=====================

const Selections = () => {
	const {addItem} = useCart();
	const {inCart} = useCart();
	const {managerData} = useSelectionContext();
	const {setCleanUp} = useSelectionContext();
	const {editNewTeam, setEditNewTeam} = useSelectionContext();
	const {playerz} = useSelectionContext();

	//HAs the season started?
	const {inSeason, setInSeason} = useSelectionContext();
	// setInSeason(true);

	// the value of the search field
	const {narrow, setNarrow} = useSelectionContext();
	const [name, setName] = useState("");

	/* state to indicate that a manager's name has been entered and the Button clicked */
	const [managerEntry, setManagerEntry] = useState(false);

	const {defCount, setDefCount} = useSelectionContext();
	const {midCount, setMidCount} = useSelectionContext();
	const {stCount, setStCount} = useSelectionContext();

	const {setManagerExists} = useSelectionContext();
	const {latestManagerId, setLatestManagerId} = useSelectionContext();
	const {setSelectedManager} = useSelectionContext();
	const {keywordEntered, setKeywordEntered} = useSelectionContext();
	const {foundManager, setFoundManager} = useSelectionContext();
	const {keywordInput, setKeywordInput} = useSelectionContext();

	const {thisManager, setThisManager} = useSelectionContext();

	const findManager = () => {
		try {
			console.log(`findManager CLICKED`);
			setManagerExists(false);
			setManagerEntry(false);
			setSelectedManager();
			setNarrow(false);

			if (managerData) {
				if (keywordInput.length === 0) {
					setManagerEntry(false);
					setKeywordEntered(false);
					setNarrow(false);
					setEditNewTeam(false);
					setCleanUp(true);
				}

				if (keywordInput.length > 0 && keywordInput.length < 3) {
					setManagerEntry(false);
					setKeywordEntered(true);
					setNarrow(false);
					setEditNewTeam(false);
				}

				if (keywordInput.length > 2) {
					setFoundManager();
					setKeywordEntered(true);
					setCleanUp(false);

					managerData
						? console.log(
							"managerData  23232  type= ",
							Array.isArray(managerData)
						)
						: console.log("managerData does not EXIST 23232");

					let result;

					if (Number(latestManagerId) !== -1) {

						if (Array.isArray(managerData)) {
							result = managerData.filter((manager) => {
								const matchName = manager.manager
									.toLowerCase()
									.includes(keywordInput.toLowerCase());

								let matchLength = false;
								manager.manager.length === keywordInput.length
									? (matchLength = true)
									: (matchLength = false);
								
								let match = matchName && matchLength;

								return match;
							});
						} else {
							throw new Error("No managerData 234");
						}

					 setFoundManager(result);

					}
				}
			} else {
				setFoundManager([]);
				setManagerExists(false);
				setManagerEntry(false);
				setKeywordEntered(false);
				setLatestManagerId(-1);
				return;

				// If the text field is empty, show no Manager
			}

			setThisManager({manager: keywordInput});
		} catch (error) {
			console.log("Error in findManager  ==  ", error);
		}
	}

	useEffect(() => {
		!!foundManager
			? !!foundManager.length > 0
				? setManagerExists(true)
				: setManagerExists(false)
			: setManagerExists(false);
	}, [foundManager]);

	const handleKeyword = (e) => {
		console.log(`handleKeyword cg456 ==  ${e.target.value}`);
		console.log(`Keyword Length cg456 ==  ${e.target.value.length}`);
		const input = e.target.value;
		setKeywordInput(input);
		console.log(`keywordInput js909 ==  ${keywordInput}`);
	};
	
	useEffect(() => {
		if(keywordInput.length > 2) {
		console.log('keywordInput', keywordInput)
			findManager();
	} else {
		setFoundManager()
		setManagerExists(false)
		setManagerEntry(false)
		setKeywordEntered(false)
		setLatestManagerId(-1)
		setEditNewTeam(false)
		setCleanUp(true)}
	}, [keywordInput]);

	const [foundPlayers, setFoundPlayers] = useState();

	const filter = (e) => {
		const playerKeyword = e.target.value;
		if (playerKeyword !== "") {
			const results = playerz["playerData"].filter((player) => {
				// console.log("player  6000= ", player);
				if (!inCart(player.playerId)) {
					return player.playerDetails.playerName
						.toLowerCase()
						.includes(playerKeyword.toLowerCase());
					// Use the toLowerCase() method to make it case-insensitive
				} else {
					return "";
				}
			});

			setFoundPlayers(results);
		} else {
			setFoundPlayers();
		}

		setName(playerKeyword);
	};

	const enterManagerClicked = () => {
		foundManager
			? console.log("0088 What is foundManager 7 = ", foundManager.length)
			: console.log("No foundManager at 66876");

		setManagerEntry(true);
		setDefCount(0);
		setMidCount(0);
		setStCount(0);

		if (foundManager && foundManager.length > 1) {
			setNarrow(true);
		}

		const startEditing = async () => {
			await setEditNewTeam(true);
			await setSelectedManager();
			await setManagerExists(false);
			await setFoundManager();
			await setNarrow(false);
		};

		if (!foundManager || foundManager.length < 1) {
			console.log("6969 Need to create new manager");
			startEditing();
			setNarrow(false);
		}
		if (foundManager && foundManager.length === 1) {
			setSelectedManager(foundManager);

			setNarrow(true);
			const existingTeam = foundManager[0].teamDetails;
			setFoundManager(existingTeam);
		}
	};
	const playerForm = document.querySelector(".playerSearchI");
	const cancelI = document.querySelector(".cancel-btn-1");
	if (cancelI) {
		cancelI.addEventListener("click", () => {
			playerForm.value = "";
		});
	}

	const resetIt = () => {
		const playerSearch = document.getElementById("playersearchI");
		if (playerSearch) {
			document.getElementById("playersearchI").value = "";
		}
		setFoundPlayers();
	};

	// ========================================================================
	const PlayerSearchInput = forwardRef((props, playerSearchRef) => (
		<input ref={playerSearchRef} {...props} />
	));

	const capitalized = (word) => {
		let newWord = word.charAt(0).toUpperCase() + word.slice(1);
		return newWord;
	};

	const cancelInput = () => {
		setName("");
		resetIt();
		setManagerEntry(false);
		setKeywordEntered(false);
		setNarrow(false);
		setEditNewTeam(false);
		setFoundManager();
		setCleanUp(true);
	};

	PlayerSearchInput.displayName = "PlayerSearchInput";

	return (
		<div className="">
			<div className="">
				<div className="justify-center max-w-xl pt-2 w-100">
					<span className="flex flex-row align-middle justify-center h-12 p-0 text-slate-50 font-medium text-3xl rounded-md">
						<Football24 height={36} className="pr-4" />
						TeamBuilder
					</span>
					{inSeason && (
						<div className="mt-1 mb-4 flex justify-center">
							<span className="text-red-400 text-xl font-semibold">
								Too late! .....the season is underway
							</span>
						</div>
					)}
					{!inSeason && (
						<p className="text-white font-light">
							Input Manager team choices for Dream Team
						</p>
					)}
				</div>
				<div className="max-w-lg rounded-md pb-2 px-2 mb-0 mx-auto bg-gradient-to-r from-blue-500 to-blue-600">
					{!editNewTeam && !inSeason && (
						<div className="h-min  rounded-md">
							<div div className="flex flex-row gap-2 pt-6">
								<input
									type="search"
									value={keywordInput}
									onChange={handleKeyword}
									className="bg-slate-200 teaxt-slate-800 input ml-4 mb-0 py-2"
									placeholder="Enter Manager name"
									autoFocus
								/>
								{!narrow &&
									(!foundManager ||
										foundManager.length < 1) &&
									!!(keywordInput.length > 2) && (
										<button
											id="enterManager"
											className="bg-greh-500 hover:bg-sky-800 text-white font-semibold py-2 px-4  border-blue-800 drop-shadow-2xl rounded"
											onClick={() =>
												enterManagerClicked()
											}
										>
											Create
										</button>
									)}
							</div>
							{!narrow &&
								(!foundManager || foundManager.length < 1) && (
									<div>
										<p className="text-slate-300  text-xl font-semibold px-6 my-6">
											Enter a manager name
											<span className="block pt-0 text-slate-700">
												to see if the name is available
											</span>
										</p>
									</div>
								)}

							{/* <div className="flex flex-row gap-2">
								<p className="">
									{" "}
									FoundManager == {foundManager?.length}
								</p>
								{!!narrow && (
									<p className=""> Narrow == true</p>
								)}
								{!narrow && (
									<p className=""> Narrow == false</p>
								)}
								{keywordEntered && (
									<p className=""> Keyword Entered == true</p>
								)}
								{!keywordEntered && (
									<p className="">
										{" "}
										Keyword Entered == false
									</p>
								)}
							</div> */}

							{foundManager &&
								foundManager.length > 0 &&
								keywordEntered && (
									<div className="text-slate-900 text-2xl px-6 mt-6">
										<p className="text-slate-100 text-xl">
											This name is taken
											<span className="block text-slate-800 text-2xl">
												Choose a different manager name
												to continue{" "}
											</span>
										</p>
									</div>
								)}

							{narrow && <div>Narrow your selection</div>}
							{/* {state.manager !== "" ? ( */}
						</div>
					)}

					{editNewTeam && (
						<div className="flex flex-col gap-2">
							<div className="">
								<div className="pl-6 py-4 mt-2 bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg">
									<h4 className="mb-0 text-slate-50">
										Adding New Team{" "}
									</h4>
									<div className="relative flex flex-row gap-2 justify-items-end">
										<div>
											<h4>
												<span className="text-slate-50 text-xl font-extralight">
													for manager name{" "}
												</span>
												<span className="text-2xl text-blue-200 font-semibold">
													{capitalized(
														thisManager.manager
													)}
												</span>
											</h4>
										</div>
										<button
											id="cancel-btn-1"
											className=" z-10 absolute right-4 bg-blue-500 hover:bg-blue-400 text-white font-bold py-2 px-4 rounded"
											onClick={() => cancelInput()}
										>
											Cancel
										</button>
									</div>

									{/*--- The Modal -  */}
									<div id="myModal" className="modal">
										{/* <!-- Modal content --> */}
										<div className="modal-content">
											<span className="close">
												&times;
											</span>
											<p>
												Are you sure you want to
												cancel..
											</p>
											<div className="">
												<button
													id="cancelBtn"
													className="btn btn-danger"
													onClick={() =>
														cancelInput()
													}
												>
													Yes
												</button>
												<button
													id="modalClose"
													className="btn btn-success"
													// onClick={alert("closeModal")}
												>
													No
												</button>
											</div>
										</div>
									</div>
								</div>
							</div>
							<div className="text-slate-100 p-8 rounded-md bg-gradient-to-r from-green-600 to-green-700">
								<p className="mx-2 mb-0 py-2 text-lg font-medium">
									{" "}
									Input your player selections below:
								</p>
								<form
									id="playersearch"
									className="flex flex-row gap-2 my-2relative"
								>
									<PlayerSearchInput
										id="playersearchI"
										type="search"
										value={name}
										onChange={filter}
										className=" input mx-2 bg-white text-slate-900"
										placeholder="Add player name"
										autoFocus
									/>
									<input
										type="reset"
										className=" bg-green-800 hover:bg-green-500  font-bold py-2 px-3 align-middle my-0 rounded"
										onClick={() => {
											console.log("RESET CLICKED");
											setName("");
										}}
										value="Clear"
									/>
								</form>
							</div>
						</div>
					)}
					{/* ) : ( */}
					{/* )} */}
					{managerEntry &&
						foundPlayers &&
						foundPlayers.length > 0 && (
							<table className="table-fixed xs:w-[280px] md:[540px] mt-4">
								<thead className="text-white bg-orange-700">
									<tr className="h-8 p-4">
										<td className="px-2 w-12">ID</td>
										<td className="pl-2">Name</td>
										<td className="w-10 pl-2">Pos</td>
										<td className="pl-2 w-12">Club</td>
										<td className="pl-2 w-10">Value</td>
										<td className="w-8"></td>
									</tr>
								</thead>
								<tbody className="bg-slate-50">
									{foundPlayers.map((player) => (
										<tr
											className="m-6"
											key={player.playerId}
										>
											<td className="pl-2">
												{player.playerId}
											</td>
											<td className="font-semibold pl-2">
												{
													player.playerDetails
														.playerName
												}
											</td>
											<td className="pl-2 mx-1">
												{
													player.playerDetails
														.playerPosition
												}
											</td>
											<td className="pl-2 mx-1">
												{
													player.playerDetails
														.playerClub
												}
											</td>
											<td className="pl-2 mx-1">
												{
													player.playerDetails
														.playerValue
												}
											</td>
											<td className="pl-2 mx-1 player-club">
												<button
													key={player.playerId}
													id="addPlayer"
													className="btn btn-primary"
													onClick={() => {
														const submittedplayer =
															{
																id: player.playerId,
																price: player
																	.playerDetails
																	.playerValue,
																pos: player
																	.playerDetails
																	.playerPosition,
																player: player,
															};
														submittedplayer.pos ===
														"DEF"
															? setDefCount(
																	defCount + 1
															  )
															: submittedplayer.pos ===
															  "MID"
															? setMidCount(
																	midCount + 1
															  )
															: submittedplayer.pos ===
															  "STR"
															? setStCount(
																	stCount + 1
															  )
															: console.log(
																	"GOALKEEPER"
															  );
														addItem(
															submittedplayer
														);
														console.log(
															"player xxx   == ",
															player
														);
														setName("");
														setFoundPlayers("");
													}}
												>
													Select
												</button>
											</td>
										</tr>
									))}
								</tbody>
							</table>
						)}
				</div>
			</div>
		</div>
	);
};

export default Selections;
