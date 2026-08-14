import "bootstrap/dist/css/bootstrap.min.css";
import Selections from "../../components/Selections.js";
import FoundManager from "../../components/foundManager.js";
import "../../css/App.css";
import Cart from "../../components/Cart.js";
import { CartProvider } from "react-use-cart";

function Capture() {	
	return (
		<CartProvider>
			<div className="absolute top-10 z-0 w-full xs:max-w-full min-h-screen bg-[url('/betweenthelions.png')] md:bg-[url('/betweenthelions.png')] bg-cover ">
				<div className=" mt-20 lg:ml-10 sm:ml-2">
					<div className="lg:m-6 sm:m-1 xs:max-w-screen flex flex-col gap-2">
						<div className="mt-16 p-4 bg-coralreef-950 bg-opacity-75 lg:w-[570px] max-w-screen-sm rounded-xl">
							<div className="">
								<Selections className="" />
								<Cart className="" />
							</div>
							<div className=" mb-0">
								<FoundManager />
							</div>
						</div>
					</div>
				</div>
			</div>
		</CartProvider>
	);
}
export default Capture;
