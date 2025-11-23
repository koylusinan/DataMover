#!/bin/bash

docker exec kafka-connect bash -c "
cat > /tmp/TestOracle.java << 'EOF'
import java.sql.*;

public class TestOracle {
    public static void main(String[] args) {
        String url = \"jdbc:oracle:thin:@oracle-xe:1521/FREEPDB1\";
        String user = \"DEBEZIUM\";
        String password = \"Srvhb0420\";

        try {
            Connection conn = DriverManager.getConnection(url, user, password);
            System.out.println(\"✅ Connection successful!\");

            Statement stmt = conn.createStatement();
            ResultSet rs = stmt.executeQuery(\"SELECT banner FROM v\\\$version\");

            while(rs.next()) {
                System.out.println(\"Oracle Version: \" + rs.getString(1));
            }

            rs.close();
            stmt.close();
            conn.close();
        } catch (Exception e) {
            System.out.println(\"❌ Connection failed!\");
            e.printStackTrace();
        }
    }
}
EOF

# Compile and run
javac -cp /kafka/connect/debezium-connector-oracle/ojdbc8.jar /tmp/TestOracle.java 2>&1
java -cp /kafka/connect/debezium-connector-oracle/ojdbc8.jar:/tmp TestOracle 2>&1
"
