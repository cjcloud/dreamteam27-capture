// import React from "react";
import { useCart } from "react-use-cart";
import { useEffect } from "react";
import {useSelectionContext,} from "../context/SelectionContext.js";
import { getDatabase, ref } from "firebase/database";
import {update} from "firebase/database";
import Football24 from "./logo.jsx";



const Cart = () => {
	const { managerState } = useSelectionContext();
	const { managerExists } = useSelectionContext();
	const { newManager, setNewManager } = useSelectionContext();
	const { keywordEntered } = useSelectionContext();
	const { defCount, midCount, stCount } = useSelectionContext();
	const { setDefCount, setMidCount, setStCount } = useSelectionContext();
	const { cleanUp, setCleanUp } = useSelectionContext();
	const {setEditNewTeam} = useSelectionContext();
	const { inSeason } = useSelectionContext();
	const {
		isEmpty,
		totalUniqueItems,
		items,
		totalItems,
		cartTotal,
		removeItem,
		emptyCart,
	} = useCart();

	console.log("managerState =  ", managerState);

	const { managerData } = useSelectionContext();
	const { narrow } = useSelectionContext();
	
	const { thisManager, setThisManager } = useSelectionContext();
	const { latestManagerId, setLatestManagerId } = useSelectionContext();

	console.log("items = ", items);
	console.log("managerState = ", managerState);
console.log('inSeason = ', inSeason)
	let newManagerData = [];
	
	const nullState = {
		managerId: 999,
		manager: "",
		teamDetails: [],
	};

	const cartSubmitted = () => {
		const managervar = thisManager.manager
		alert(` ${managervar}'s team submiited to firebase `);
	};

	const teamDetails = (data) => {
		const details = data.map((item) => {
			console.log("item.player  - ", item.player);
			return  item.player;
		});
		return details;
	};

	const capitalized = (word) => {
		let newWord = word.charAt(0).toUpperCase() + word.slice(1);
		return newWord;
	};

	const createManager = async () => {
		const newID = managerData.length
		console.log("managerData.length ==== ", managerData.length)	
		console.log("newID is now 9222==== ", newID)
		newManagerData = {
			managerId: newID,
			manager: capitalized(thisManager.manager),
			posNow: 99,
			posLast: 99,
			totalPoints:0,
			teamDetails: teamDetails(items),
		};
		await setNewManager(newManager);
		console.log("New ManagerData  = ", newManagerData);
		await setLatestManagerId(newID)
		console.log("newManagerID 00004  == ", latestManagerId)
		await updateManagerFile();
		
	};

	
	const updateManagerFile = async (newManager) => {
		const db = getDatabase();
		
		console.log("newManagerData.managerId  = ", newManagerData.managerId);
		await update(
			ref(db, "0/" + newManagerData.managerId),
			newManagerData
		).then(() =>
			console.log("Manager updated in firebase  ---- ", latestManagerId)
		).then(() => {
			setCleanUp(true)
			setEditNewTeam(false)
			cartSubmitted()
		}
		);
	};

	// 	dataService.append();

	// 	if (newManager === null) {
	// 		return;
	// 	}

	// 	dataService
	// 		.create(newManagerData)
	// 		.on("state_changed", alert("success"), alert);
	// 	console.log("aaa  ---", newManager);
	// };

	useEffect(() => {
		if (cleanUp) {
			emptyCart();
			setDefCount(0);
			setMidCount(0);
			setStCount(0);
			setThisManager(nullState);
			setEditNewTeam(false);
			console.log("CLEAN UP DONE");
			setCleanUp(false);
		}
	}, [cleanUp, emptyCart, setDefCount, setMidCount, setStCount]);

	if (isEmpty) {

		return (
			<>
				{!managerExists && !narrow && !keywordEntered && !inSeason &&(
					<>
						<div className="container flex flex-row gap-4 align-middle round-lg py-2 mt-4">
							<Football24 height={24} />
							<p className="text-slate-50 p-auto my-auto text-lg font-semibold ">
								Enter at least 3 characters to search
							</p>
						</div>
					</>
				)}

				{narrow && (
					<h2 className="container text center">
						{" "}
						Multiple Matches - Narrow your manager selection{" "}
					</h2>
				)}
			</>
		);
	} else {
		return (
			<section className="py-4 container">
				<div className="row justify-content-center">
					<div className="bg-slate-100 col-12 rounded-lg p-2">
						<table className="table table-hover m-0 max-w-[360px]">
							<thead className="pt-4 bg-slate-950 text-slate-50 rounded-lg">
								<tr className="border-bottom">
									<th>ID</th>
									<th>Name</th>
									<th>Pos</th>
									<th>Club</th>
									<th>Value</th>
									<th className="text-center">Del</th>
								</tr>
							</thead>
							<tbody className="max-w-sm">
								{items.map((item, index) => {
									return (
										<tr
											key={item.id}
											className="sm:max-w-[280px]"
										>
											<td className="align-middle">
												{item.id}{" "}
											</td>
											<td className="align-middle">
												<strong>
													{" "}
													{
														item.player
															.playerDetails
															.playerName
													}
												</strong>
											</td>
											<td className="align-middle">
												{" "}
												{
													item.player.playerDetails
														.playerPosition
												}
											</td>
											<td className="align-middle">
												{" "}
												{
													item.player.playerDetails
														.playerClub
												}
											</td>
											<td className="align-middle">
												{item.price}
											</td>
											<td>
												<button
													className="bg-garibaldi-600 text-white ms-2 p-1 rounded-lg align-middle"
													onClick={() => {
														item.pos === "DEF"
															? setDefCount(
																	defCount - 1
															  )
															: item.pos === "MID"
															? setMidCount(
																	midCount - 1
															  )
															: item.pos === "STR"
															? setStCount(
																	stCount - 1
															  )
															: console.log(
																	"GOALKEEPER"
															  );
														removeItem(item.id);
													}}
												>
													{" "}
													X
												</button>
											</td>
										</tr>
									);
								})}
							</tbody>
						</table>
						<div className="col-auto ms-auto my-4">
							<h5 className="light">
								{" "}
								Team({totalUniqueItems}) total items (
								{totalItems}){" "}
							</h5>
							<p>
								Team Formation is: <br></br>
								<strong>
									{defCount}:{midCount}:{stCount}
								</strong>
								<br></br> DEF:MID:ST
							</p>
							<h2 className="text-slate-900">
								{" "}
								Total Team Value: £{cartTotal}m
							</h2>
							{cartTotal > 50 ? (
								<h5 className="warning">
									You have exceeded £50M - Remove some players
								</h5>
							) : (
								""
							)}
							{totalItems !== 11 ? (
								<button className="disabled btn btn-secondary">
									Choose 11 teams first!
								</button>
							) :
								(
									<button
										className="btn btn-primary"
										onClick={(e) => {
											createManager(items);
											console.log(
												"managerState CART2 == ",
												managerState
											);
										}}
									>
										Confirm Final Selection
									</button>
								)}
						</div>
					</div>
				</div>
			</section>
		);
	}
};

export default Cart;
