type BedManagementLayoutProps = {
  children: React.ReactNode;
};

export default function BedManagementLayout({ children }: BedManagementLayoutProps) {
  return <section className="bed-management-layout">{children}</section>;
}
