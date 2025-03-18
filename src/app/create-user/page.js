import Navbar from "@/components/navbar";
import SignupForm from "@/components/sections/SignupForm";

export default function SignupPage() {
  return (
    <div>
      <Navbar />
      <div className="min-h-screen bg-gray-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Create a New Account
          </h2>
        </div>
        <SignupForm />
      </div>
    </div>
  );
}
