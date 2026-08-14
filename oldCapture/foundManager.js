import React from "react";
import { useSelectionContext } from "../context/SelectionContext.js";

function FoundManager() {
	const { foundManager, setFoundManager, editNewTeam } = useSelectionContext();
	const {thisManager} = useSelectionContext();
	const {keywordInput} = useSelectionContext() || "";
	// console.log("thisManager903 :>> ", thisManager);
	let foundLength = 0;
	
	if (!!foundManager) {
		console.log("foundManager :>> ", foundManager);
		console.log("foundManager.length :>> ", foundManager.length);
	
		console.log("foundLength sk45 :>> ", foundLength);
	} else {
		setFoundManager([]);
	}

		// console.log("totalteam :>> ", totalteam);
	
	let word = thisManager.manager;
	const capitalized = word.charAt(0).toUpperCase() + word.slice(1);

	const totalTeam = () => {
		let totTeam = 0;
		foundManager ? foundManager[0]?.teamDetails.map(
			(player) => (totTeam = totTeam + player.playerDetails.playerValue)
		): (totTeam = 0);
		return totTeam;
	};

	return (
		<>
			<div className="my-auto">
				{foundLength > 0 &&  (
					<>
						<div className="max-w-lg mt-2 mb-2 mx-auto bg-gradient-to-r from-garibaldi-600 to-garibaldi-500 rounded-lg">
							<span className="">
								<p className="h-10 m-0 pt-2 pb-[50px] px-4 text-2xl text-slate-100 font-light ">
									A team exists for:{" "}
									<span className="mb-2 text-2xl font-bold text-slate-50">
										{foundManager[0]?.manager || "Unknown"}
									</span>
								</p>
							</span>{" "}
						</div>
						<div className="mb-4 max-w-lg rounded-lg mx-auto border-t-md">
							<table className="table-auto rounded-t-xl border-separate">
								<thead className="m-0 text-white bg-yellow-600  border border-separate items-center">
									<tr className="rounded-t-xl ">
										<td className="w-16">
											<p className="pl-3 my-2 font-bold text-lg">
												ID
											</p>
										</td>
										<td className="w-40 pl-3">
											<p className="my-2 font-bold text-lg">
												Name
											</p>
										</td>
										<td className="w-16">
											<p className="my-2 font-bold text-lg text-center">
												Pos
											</p>
										</td>
										<td className="w-28">
											<p className="my-2 font-bold text-center text-lg">
												Club
											</p>
										</td>
										<td className="w-28 bg-transparent border-t-xl">
											<p className="my-2 font-bold text-lg text-center ">
												Value
											</p>
										</td>
									</tr>
								</thead>

								{/* Need to retrieve managerData and match with the selectedManager */}
								<tbody>
									{foundManager &&
										foundManager[0]?.teamDetails.map(
											(player) => (
												<tr
													key={player.playerid}
													className="m-0 border border-slate-50 bg-tablebg-500"
												>
													<td className="ml-2 pl-3">
														{player.playerId}
													</td>
													<td className="my-2 pl-3 bg-tablebg-500 font-semibold">
														{
															player.playerDetails
																.playerName
														}
													</td>
													<td className="my-2  bg-tablebg-500 text-gray-500 font-normal text-center">
														{
															player.playerDetails
																.playerPosition
														}
													</td>
													<td className="my-2  bg-tablebg-500 text-gray-500 font-normal text-center">
														{
															player.playerDetails
																.playerClub
														}
													</td>
													<td className="my-2 bg-tablebg-500 text-gray-600 font-semibold text-center">
														<span className="text-slate-700">
															£
														</span>
														{
															player.playerDetails
																.playerValue
														}
														<span className="text-slate-700 text-xs">
															m
														</span>
													</td>
												</tr>
											)
										)}
								</tbody>
							</table>
							<div className="">
								<div className="w-full h-[40px] relative p-2 font-semibold bg-gradient-to-r from-blue-600 to-blue-700 ">
									{" "}
									<span className="absolute text-xl text-slate-080 right-10">
										Total Team Value:
										<span className="pl-4 text-xl text-slate-100">
											£{totalTeam()}m{" "}
										</span>
									</span>
								</div>
							</div>
						</div>
					</>
				)}

				{(foundLength<1) &&
					thisManager.managerId !== 999 &&
					keywordInput.length > 2 &&
					!editNewTeam && (
						<div className="max-w-lg mt-[50px] pt-10 px-8 align-middle bg-gradient-to-r from-green-600 to-green-700 rounded-lg">
							<div className="h-[75px] text-slate-100 mx-auto">
								<span className="">
									<p className="mt-2 text-2xl font-light">
										The name{" "}
										<span className="m-0 text-2xl font-bold text-garibaldi-500">
											{capitalized}
										</span>{" "}
										can be created
									</p>
									<p className="text-green-950">
										Hit create to continue
									</p>
								</span>{" "}
							</div>
						</div>
					)}
			</div>
		</>
	);
}

export default FoundManager;
